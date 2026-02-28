import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs-extra';

export interface ImageMapping {
  url: string;
  localPath: string;
}

function convertArxivLinksToAnchors(html: string, paperId: string): string {
  const $ = cheerio.load(html, { xml: true });

  const arxivPattern = /^https?:\/\/(?:www\.)?arxiv\.org\/html\/([^\/]+)\/?(?:#.*)?$/;
  const arxivPatternWithHash = /^https?:\/\/(?:www\.)?arxiv\.org\/html\/([^\/]+)(\/v\d+)?#(.+)$/;

  $('a[href]').each((_, element) => {
    const el = $(element);
    const href = el.attr('href');

    if (!href) return;

    const matchWithHash = href.match(arxivPatternWithHash);
    if (matchWithHash) {
      const anchorId = matchWithHash[3];
      el.attr('href', `#${anchorId}`);
      return;
    }

    if (arxivPattern.test(href)) {
      el.attr('href', '#');
    }
  });

  return $.html();
}

function isSvgFile(filepath: string): boolean {
  const ext = path.extname(filepath).toLowerCase();
  return ext === '.svg' || ext === '.svgz';
}

export async function prepareForPandoc(
  html: string,
  imageMapping: ImageMapping[],
  paperId?: string,
  imagesDir?: string
): Promise<string> {
  const $ = cheerio.load(html, {
    xml: true,
  });

  const urlToFilename = new Map<string, string>();
  const urlToLocalPath = new Map<string, string>();
  for (const mapping of imageMapping) {
    const filename = path.basename(mapping.localPath);
    urlToFilename.set(mapping.url, `./images/${filename}`);
    urlToLocalPath.set(mapping.url, mapping.localPath);
  }

  // Process images - inline SVGs, update others
  const imgElements = $('img').toArray();
  for (const element of imgElements) {
    const el = $(element);
    const src = el.attr('src');
    if (!src || !urlToFilename.has(src)) continue;

    const localPath = urlToLocalPath.get(src);
    if (localPath && isSvgFile(localPath) && imagesDir) {
      try {
        const svgContent = await fs.readFile(localPath, 'utf8');
        // Create a div wrapper with the SVG content
        const wrapper = cheerio.load(svgContent, { xml: true });
        const svgElement = wrapper('svg');
        if (svgElement.length > 0) {
          // Replace img with inline SVG
          el.replaceWith(svgElement);
        }
      } catch {
        // Fall back to src update if SVG inlining fails
        el.attr('src', urlToFilename.get(src)!);
      }
    } else {
      el.attr('src', urlToFilename.get(src)!);
    }
  }

  $('math').each((_, element) => {
    const el = $(element);
    const parent = el.parent();
    if (parent.length > 0) {
      const parentTag = parent.get(0)?.tagName?.toLowerCase();
      if (parentTag !== 'div' || !parent.hasClass('ltx_math')) {
        const isOnlyChild = parent.children().length === 1;
        if (isOnlyChild && parentTag !== 'div') {
          el.wrap('<div class="ltx_math"></div>');
        }
      }
    }
  });

  let result = $.html();

  if (paperId) {
    result = convertArxivLinksToAnchors(result, paperId);
  }

  if (!result.toLowerCase().includes('<!doctype')) {
    result = '<!DOCTYPE html>\n' + result;
  }

  return result;
}
