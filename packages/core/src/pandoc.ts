import { execa } from 'execa';
import { pathExists } from 'fs-extra/esm';
import { dirname } from 'node:path';
import { PandocError } from './errors.js';

export interface PandocOptions {
  mathFormat?: 'mathml' | 'svg';
  toc?: boolean;
  metadata?: Record<string, string>;
}

export async function runPandoc(
  inputHtmlPath: string,
  outputEpubPath: string,
  options?: PandocOptions
): Promise<void> {
  const args: string[] = ['-f', 'html', '-t', 'epub3', '--standalone'];

  if (options?.mathFormat === 'mathml') {
    args.push('--mathml');
  } else if (options?.mathFormat === 'svg') {
    args.push('--webtex');
  }

  if (options?.toc) {
    args.push('--toc');
  }

  if (options?.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      args.push('--metadata', `${key}=${value}`);
    }
  }

  const inputDir = dirname(inputHtmlPath);
  const imagesDir = `${inputDir}/images`;
  if (await pathExists(imagesDir)) {
    args.push('--resource-path', inputDir);
  }

  args.push(inputHtmlPath, '-o', outputEpubPath);

  try {
    await execa('pandoc', args);
  } catch (error) {
    if (error && typeof error === 'object' && 'exitCode' in error) {
      const execaError = error as { exitCode: number; stderr?: string; message?: string };
      throw new PandocError(
        execaError.message || 'Pandoc execution failed',
        execaError.exitCode,
        execaError.stderr || ''
      );
    }
    throw error;
  }
}
