import axios from 'axios';
import { execa } from 'execa';
import { createWriteStream, createReadStream, promises as fs } from 'node:fs';
import { join, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar';
import { globby } from 'globby';
import { ensureDir, pathExists, move } from 'fs-extra/esm';
import { LatexConversionError, DependencyError } from './errors.js';

const MAIN_TEX_CANDIDATES = ['main.tex', 'ms.tex', 'paper.tex', 'article.tex'];

async function downloadLatexSource(id: string, destPath: string): Promise<void> {
  const url = `https://arxiv.org/e-print/${id}`;
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });
  await fs.writeFile(destPath, Buffer.from(response.data));
}

async function extractTarGz(tarPath: string, destDir: string): Promise<void> {
  await extract({
    file: tarPath,
    cwd: destDir,
  });
}

async function findMainTexFile(dir: string): Promise<string | null> {
  for (const candidate of MAIN_TEX_CANDIDATES) {
    const candidatePath = join(dir, candidate);
    if (await pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  const texFiles = await globby('**/*.tex', {
    cwd: dir,
    absolute: true,
  });

  if (texFiles.length === 0) {
    return null;
  }

  if (texFiles.length === 1) {
    return texFiles[0];
  }

  let largestFile = texFiles[0];
  let largestSize = 0;

  for (const file of texFiles) {
    const stats = await fs.stat(file);
    if (stats.size > largestSize) {
      largestSize = stats.size;
      largestFile = file;
    }
  }

  return largestFile;
}

async function checkCommand(command: string): Promise<boolean> {
  try {
    await execa(command, ['--version'], { reject: false });
    return true;
  } catch {
    return false;
  }
}

async function convertTexToEpub(texPath: string, outputPath: string): Promise<void> {
  const hasTex4ebook = await checkCommand('tex4ebook');
  const hasPandoc = await checkCommand('pandoc');

  if (!hasTex4ebook && !hasPandoc) {
    throw new DependencyError('Neither tex4ebook nor pandoc is installed. Please install one of them to convert LaTeX to EPUB.');
  }

  const texDir = join(texPath, '..');
  const texBasename = basename(texPath, '.tex');

  if (hasTex4ebook) {
    try {
      await execa('tex4ebook', [texPath], {
        cwd: texDir,
        reject: true,
      });

      const epubPath = join(texDir, `${texBasename}.epub`);
      if (await pathExists(epubPath)) {
        await move(epubPath, outputPath, { overwrite: true });
        return;
      }
    } catch {
      // Fall through to pandoc
    }
  }

  if (hasPandoc) {
    try {
      await execa('pandoc', [texPath, '-o', outputPath], {
        reject: true,
      });
      return;
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        throw new LatexConversionError(
          `Failed to convert LaTeX to EPUB: ${(error as Error).message}`,
          error as Error
        );
      }
      throw new LatexConversionError('Failed to convert LaTeX to EPUB');
    }
  }

  throw new LatexConversionError('Failed to convert LaTeX to EPUB with both tex4ebook and pandoc');
}

export async function convertLatexSource(
  id: string,
  outputPath: string,
  tempDir: string
): Promise<void> {
  await ensureDir(tempDir);

  const tarPath = join(tempDir, 'source.tar.gz');
  const extractDir = join(tempDir, 'extracted');

  try {
    await downloadLatexSource(id, tarPath);

    await ensureDir(extractDir);
    await extractTarGz(tarPath, extractDir);

    const mainTex = await findMainTexFile(extractDir);

    if (!mainTex) {
      throw new LatexConversionError(
        `No .tex files found in the LaTeX source for arXiv:${id}`
      );
    }

    await convertTexToEpub(mainTex, outputPath);
  } finally {
    try {
      await fs.unlink(tarPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
