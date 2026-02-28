import { tmpdir } from 'os';
import { join, dirname } from 'path';
import fs from 'fs-extra';
import { normalizeArxivId, type NormalizedArxivId } from './id-parser.js';
import { probeAvailability, type ProbeResult } from './probe.js';
import { fetchHtml } from './fetcher.js';
import { sanitizeScripts, removeTransformStyles } from './cleaner.js';
import { resolveImageUrls } from './image-resolver.js';
import { downloadImages, type ImageDownloadResult } from './image-downloader.js';
import { prepareForPandoc, type ImageMapping } from './pandoc-prep.js';
import { runPandoc } from './pandoc.js';
import { convertLatexSource } from './latex-fallback.js';
import { injectMetadata, inlineSvgs, type EpubMetadata } from './epub-meta.js';
import { checkDependencies } from './preflight.js';
import { PandocNotInstalledError, InvalidIdError, ArxivNotFoundError } from './errors.js';
import { NotFoundError } from './errors.js';

const EPUB_CSS = `
img {
  display: block;
  margin-left: auto;
  margin-right: auto;
  max-width: 100%;
  height: auto;
}
figure.ltx_figure {
  text-align: center;
}
.ltx_listing {
  font-family: monospace;
  font-size: 0.9em;
  overflow-x: auto;
  padding: 0.5em;
  margin: 1em 0;
  background-color: #f5f5f5;
}
.ltx_listingline {
  white-space: pre;
}
.ltx_lst_identifier {
  color: #006699;
}
.ltx_lst_string {
  color: #c00;
}
.ltx_lst_keyword {
  color: #069;
  font-weight: bold;
}
.ltx_lst_comment {
  color: #999;
  font-style: italic;
}
.ltx_lst_number {
  color: #099;
}
`;

export interface ConversionOptions {
  preferMathml?: boolean;
  onProgress?: (stage: string, message?: string) => void;
  metadata?: {
    title?: string;
    authors?: string[];
    abstract?: string;
    subjects?: string[];
  };
  skipPreflight?: boolean;
}

export interface ConversionResult {
  format: 'html' | 'ar5iv' | 'latex' | 'pdf_fallback';
  outputPath: string;
}

async function handleHtmlRoute(
  probeResult: { type: 'html' | 'ar5iv'; url: string },
  outputPath: string,
  tempDir: string,
  idString: string,
  options: ConversionOptions,
  onProgress: (stage: string, message?: string) => void
): Promise<void> {
  onProgress('fetching', 'Downloading HTML...');
  const { html, finalUrl } = await fetchHtml(probeResult.url);

  onProgress('cleaning', 'Sanitizing HTML...');
  let cleanedHtml = sanitizeScripts(html);
  cleanedHtml = removeTransformStyles(cleanedHtml);

  onProgress('resolving', 'Processing images...');
  // For arXiv HTML, images are in a versioned subdirectory (e.g., 2602.21548v2/)
  // but the HTML is served from the parent URL (e.g., 2602.21548 or 2602.21548v2).
  // We need to use the parent directory as base to correctly resolve image URLs.
  const finalUrlObj = new URL(finalUrl);
  const parentPath = finalUrlObj.pathname.split('/').slice(0, -1).join('/') + '/';
  const baseUrl = `${finalUrlObj.origin}${parentPath}`;
  const { cleanedHtml: resolvedHtml, imageUrls } = resolveImageUrls(cleanedHtml, baseUrl);

  const imagesDir = join(tempDir, 'images');
  let imageMapping: ImageMapping[] = [];
  
  if (imageUrls.length > 0) {
    await fs.ensureDir(imagesDir);
    onProgress('downloading', 'Downloading images...');
    const downloadResults = await downloadImages(imageUrls, imagesDir);
    imageMapping = downloadResults
      .filter((r: ImageDownloadResult) => r.success)
      .map((r: ImageDownloadResult) => ({
        url: r.originalUrl,
        localPath: r.localPath,
      }));
  }

  onProgress('preparing', 'Preparing for conversion...');
  const preparedHtml = await prepareForPandoc(resolvedHtml, imageMapping, idString, imagesDir);

  const inputHtmlPath = join(tempDir, 'input.html');
  await fs.writeFile(inputHtmlPath, preparedHtml);

  const cssPath = join(tempDir, 'epub.css');
  await fs.writeFile(cssPath, EPUB_CSS);

  onProgress('converting', 'Converting to EPUB...');
  await runPandoc(inputHtmlPath, outputPath, {
    mathFormat: options.preferMathml !== false ? 'mathml' : 'svg',
    cssPath,
  });
}

async function handleLatexRoute(
  id: string,
  outputPath: string,
  tempDir: string,
  onProgress: (stage: string, message?: string) => void
): Promise<void> {
  onProgress('latex', 'Converting from LaTeX source...');
  await convertLatexSource(id, outputPath, tempDir);
}

async function handlePdfRoute(
  id: string,
  outputPath: string,
  tempDir: string,
  onProgress: (stage: string, message?: string) => void
): Promise<void> {
  onProgress('pdf', 'PDF fallback - downloading...');
  throw new Error(
    `PDF fallback not implemented for arXiv:${id}. Manual conversion required.`
  );
}

export async function convertArxivToEpub(
  idOrUrl: string,
  outputPath: string,
  options?: ConversionOptions
): Promise<ConversionResult> {
  const onProgress = options?.onProgress || (() => {});

  if (!options?.skipPreflight) {
    onProgress('preflight', 'Checking dependencies...');
    const preflight = await checkDependencies();
    if (!preflight.pandoc) {
      throw new PandocNotInstalledError();
    }
  }

  const normalizedId: NormalizedArxivId | null = normalizeArxivId(idOrUrl);
  if (!normalizedId) {
    throw new InvalidIdError(idOrUrl);
  }

  const idString = normalizedId.version
    ? `${normalizedId.id}v${normalizedId.version}`
    : normalizedId.id;

  const tempDir = join(tmpdir(), `arxiv-${Date.now()}`);
  await fs.ensureDir(tempDir);

  try {
    onProgress('probing', 'Checking available formats...');
    const probeResult: ProbeResult = await probeAvailability(idString);

    let format: ConversionResult['format'];

    switch (probeResult.type) {
      case 'html':
        await handleHtmlRoute(
          { type: 'html', url: probeResult.url },
          outputPath,
          tempDir,
          idString,
          options || {},
          onProgress
        );
        format = 'html';
        break;

      case 'ar5iv':
        await handleHtmlRoute(
          { type: 'ar5iv', url: probeResult.url },
          outputPath,
          tempDir,
          idString,
          options || {},
          onProgress
        );
        format = 'ar5iv';
        break;

      case 'latex':
        await handleLatexRoute(idString, outputPath, tempDir, onProgress);
        format = 'latex';
        break;

      case 'pdf':
        await handlePdfRoute(idString, outputPath, tempDir, onProgress);
        format = 'pdf_fallback';
        break;
    }

    onProgress('metadata', 'Adding metadata...');
    const epubMetadata: EpubMetadata = {
      title: options?.metadata?.title || `arXiv:${idString}`,
      authors: options?.metadata?.authors || [],
      abstract: options?.metadata?.abstract || '',
      arxivId: idString,
      subjects: options?.metadata?.subjects || [],
    };
    await injectMetadata(outputPath, epubMetadata);

    onProgress('inlining', 'Inlining SVG images...');
    await inlineSvgs(outputPath);

    onProgress('complete', 'Done!');

    return {
      format,
      outputPath,
    };
  } finally {
    await fs.remove(tempDir);
  }
}
