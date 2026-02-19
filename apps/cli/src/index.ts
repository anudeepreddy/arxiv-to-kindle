#!/usr/bin/env node
import { Command } from 'commander';
import { 
  convertArxivToEpub, 
  normalizeArxivId,
  checkDependencies,
  PandocNotInstalledError,
  Tex4ebookNotInstalledError,
  ArxivNotFoundError,
  InvalidIdError,
  DependencyError
} from '@arxiv-to-kindle/core';
import { resolve, basename } from 'path';
import { existsSync } from 'fs';
import { mkdirSync, writeFileSync } from 'fs';

const program = new Command();

program
  .name('arxiv-to-kindle')
  .description('Convert arXiv papers to EPUB format for e-readers')
  .version('0.1.0')
  .argument('<id>', 'arXiv ID or URL (e.g., 2401.12345 or https://arxiv.org/abs/2401.12345)')
  .argument('[output]', 'Output EPUB file path', '')
  .option('--math-svg', 'Use SVG for math rendering instead of MathML')
  .option('--verbose', 'Show detailed progress information')
  .option('--no-metadata', 'Skip metadata injection')
  .option('--skip-preflight', 'Skip dependency checks')
  .action(async (id: string, output: string, options: { mathSvg: boolean; verbose: boolean; metadata: boolean; skipPreflight: boolean }) => {
    const normalized = normalizeArxivId(id);
    
    if (!normalized) {
      console.error(`Error: Invalid arXiv ID: ${id}`);
      console.error('Expected format: 2401.12345 or https://arxiv.org/abs/2401.12345');
      process.exit(1);
    }

    const idString = normalized.version 
      ? `${normalized.id}v${normalized.version}` 
      : normalized.id;
    
    const outputPath = output || `${idString}.epub`;
    const resolvedOutput = resolve(outputPath);

    if (options.verbose) {
      console.log(`arXiv ID: ${idString}`);
      console.log(`Output: ${resolvedOutput}`);
    }

    const outputDir = resolve(resolvedOutput, '..');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    if (!options.skipPreflight) {
      if (options.verbose) {
        console.log('Checking dependencies...');
      }
      const preflight = await checkDependencies();
      if (!preflight.pandoc) {
        console.error('Error: Pandoc not found.');
        console.error('Install via: https://pandoc.org/installing.html');
        process.exit(1);
      }
      if (!preflight.tex4ebook && options.verbose) {
        console.log('Warning: tex4ebook not found. LaTeX source conversion may not work.');
        console.log('Install via: https://github.com/michal-h21/tex4ebook');
      }
    }

    try {
      const result = await convertArxivToEpub(id, resolvedOutput, {
        preferMathml: !options.mathSvg,
        skipPreflight: options.skipPreflight,
        onProgress: options.verbose 
          ? (stage: string, message?: string) => {
              console.log(`[${stage}] ${message || ''}`);
            }
          : undefined,
      });

      if (options.verbose) {
        console.log(`Conversion complete! Source format: ${result.format}`);
      }
      console.log(`Created: ${resolvedOutput}`);
    } catch (error) {
      if (error instanceof PandocNotInstalledError) {
        console.error('Error: Pandoc not found.');
        console.error('Install via: https://pandoc.org/installing.html');
        process.exit(1);
      }
      if (error instanceof Tex4ebookNotInstalledError) {
        console.error('Error: tex4ebook not found.');
        console.error('Install via: https://github.com/michal-h21/tex4ebook');
        process.exit(1);
      }
      if (error instanceof ArxivNotFoundError) {
        console.error(`Error: Paper not found (404).`);
        console.error(`The arXiv ID "${idString}" does not exist or is not accessible.`);
        process.exit(1);
      }
      if (error instanceof InvalidIdError) {
        console.error(`Error: Invalid arXiv ID: ${id}`);
        console.error('Expected format: 2401.12345 or https://arxiv.org/abs/2401.12345');
        process.exit(1);
      }
      if (error instanceof DependencyError) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse();
