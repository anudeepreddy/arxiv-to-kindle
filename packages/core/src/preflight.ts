import { execa } from 'execa';

export interface PreflightResult {
  pandoc: boolean;
  tex4ebook: boolean;
  errors: string[];
}

export async function checkDependencies(): Promise<PreflightResult> {
  const result: PreflightResult = {
    pandoc: false,
    tex4ebook: false,
    errors: [],
  };

  try {
    await execa('pandoc', ['--version']);
    result.pandoc = true;
  } catch {
    result.errors.push('Pandoc not found. Install via: https://pandoc.org/installing.html');
  }

  try {
    await execa('tex4ebook', ['--version']);
    result.tex4ebook = true;
  } catch {
    result.errors.push('tex4ebook not found. Install via: https://github.com/michal-h21/tex4ebook');
  }

  return result;
}
