import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { execa } from 'execa';
import { globby } from 'globby';
import { pathExists, move } from 'fs-extra/esm';
import { convertLatexSource } from './latex-fallback';
import { LatexConversionError, DependencyError } from './errors';

vi.mock('axios');
vi.mock('execa');
vi.mock('globby');
vi.mock('fs-extra/esm', () => ({
  ensureDir: vi.fn(),
  pathExists: vi.fn(),
  move: vi.fn(),
}));
vi.mock('node:fs', () => ({
  promises: {
    writeFile: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  },
  createWriteStream: vi.fn(),
  createReadStream: vi.fn(),
}));
vi.mock('tar', () => ({
  extract: vi.fn(),
}));

const mockAxios = vi.mocked(axios);
const mockExeca = vi.mocked(execa);
const mockGlobby = vi.mocked(globby);
const mockPathExists = vi.mocked(pathExists);
const mockMove = vi.mocked(move);

describe('convertLatexSource', () => {
  const id = '2301.00001';
  const outputPath = '/output/test.epub';
  const tempDir = '/tmp/latex-test';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxios.get.mockResolvedValue({
      data: Buffer.from('fake tar.gz content'),
    });
    mockPathExists.mockImplementation(async (path: string) => {
      if (typeof path === 'string') {
        if (path.endsWith('main.tex')) return true;
        if (path.endsWith('.epub')) return true;
      }
      return false;
    });
    mockGlobby.mockResolvedValue([]);
    mockExeca.mockResolvedValue({} as never);
    mockMove.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('downloading', () => {
    it('downloads from correct arXiv e-print URL', async () => {
      await convertLatexSource(id, outputPath, tempDir);

      expect(mockAxios.get).toHaveBeenCalledWith(
        `https://arxiv.org/e-print/${id}`,
        expect.objectContaining({
          responseType: 'arraybuffer',
        })
      );
    });
  });

  describe('finding main.tex', () => {
    it('finds main.tex when it exists', async () => {
      mockPathExists.mockImplementation(async (path: string) => {
        if (typeof path === 'string' && path.endsWith('main.tex')) return true;
        return false;
      });

      await convertLatexSource(id, outputPath, tempDir);

      expect(mockExeca).toHaveBeenCalledWith(
        'tex4ebook',
        [expect.stringContaining('main.tex')],
        expect.any(Object)
      );
    });

    it('finds ms.tex when main.tex does not exist', async () => {
      mockPathExists.mockImplementation(async (path: string) => {
        if (typeof path === 'string') {
          if (path.endsWith('main.tex')) return false;
          if (path.endsWith('ms.tex')) return true;
        }
        return false;
      });

      await convertLatexSource(id, outputPath, tempDir);

      expect(mockExeca).toHaveBeenCalledWith(
        'tex4ebook',
        [expect.stringContaining('ms.tex')],
        expect.any(Object)
      );
    });

    it('finds paper.tex when main.tex and ms.tex do not exist', async () => {
      mockPathExists.mockImplementation(async (path: string) => {
        if (typeof path === 'string') {
          if (path.endsWith('main.tex')) return false;
          if (path.endsWith('ms.tex')) return false;
          if (path.endsWith('paper.tex')) return true;
        }
        return false;
      });

      await convertLatexSource(id, outputPath, tempDir);

      expect(mockExeca).toHaveBeenCalledWith(
        'tex4ebook',
        [expect.stringContaining('paper.tex')],
        expect.any(Object)
      );
    });

    it('finds article.tex when other candidates do not exist', async () => {
      mockPathExists.mockImplementation(async (path: string) => {
        if (typeof path === 'string') {
          if (path.endsWith('main.tex')) return false;
          if (path.endsWith('ms.tex')) return false;
          if (path.endsWith('paper.tex')) return false;
          if (path.endsWith('article.tex')) return true;
        }
        return false;
      });

      await convertLatexSource(id, outputPath, tempDir);

      expect(mockExeca).toHaveBeenCalledWith(
        'tex4ebook',
        [expect.stringContaining('article.tex')],
        expect.any(Object)
      );
    });

    it('picks largest .tex file when no candidate exists', async () => {
      mockPathExists.mockResolvedValue(false);
      mockGlobby.mockResolvedValue([
        '/tmp/latex-test/extracted/small.tex',
        '/tmp/latex-test/extracted/large.tex',
        '/tmp/latex-test/extracted/medium.tex',
      ]);

      const mockFs = await import('node:fs');
      const mockStat = vi.mocked(mockFs.promises.stat);
      mockStat.mockImplementation(async (path: string | object) => {
        if (typeof path === 'string') {
          if (path.endsWith('small.tex')) return { size: 100 } as any;
          if (path.endsWith('medium.tex')) return { size: 500 } as any;
          if (path.endsWith('large.tex')) return { size: 1000 } as any;
        }
        return { size: 0 } as any;
      });

      await convertLatexSource(id, outputPath, tempDir);

      expect(mockExeca).toHaveBeenCalledWith(
        'tex4ebook',
        [expect.stringContaining('large.tex')],
        expect.any(Object)
      );
    });

    it('uses single .tex file when only one exists', async () => {
      mockPathExists.mockResolvedValue(false);
      mockGlobby.mockResolvedValue(['/tmp/latex-test/extracted/only.tex']);

      await convertLatexSource(id, outputPath, tempDir);

      expect(mockExeca).toHaveBeenCalledWith(
        'tex4ebook',
        [expect.stringContaining('only.tex')],
        expect.any(Object)
      );
    });

    it('throws LatexConversionError when no .tex files found', async () => {
      mockPathExists.mockResolvedValue(false);
      mockGlobby.mockResolvedValue([]);

      await expect(convertLatexSource(id, outputPath, tempDir)).rejects.toThrow(
        LatexConversionError
      );
    });
  });

  describe('conversion', () => {
    it('uses tex4ebook when available', async () => {
      mockExeca.mockImplementation(async (cmd: string) => {
        if (cmd === 'tex4ebook' || cmd === '--version') {
          return {} as any;
        }
        return {} as any;
      });

      await convertLatexSource(id, outputPath, tempDir);

      const calls = mockExeca.mock.calls;
      const tex4ebookCall = calls.find(call => call[0] === 'tex4ebook');
      expect(tex4ebookCall).toBeDefined();
    });

    it('falls back to pandoc when tex4ebook fails', async () => {
      let tex4ebookCalled = false;
      let pandocCalled = false;

      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'tex4ebook' && args?.[0]?.endsWith('.tex')) {
          tex4ebookCalled = true;
          throw new Error('tex4ebook failed');
        }
        if (cmd === 'pandoc') {
          pandocCalled = true;
          return {} as any;
        }
        return {} as any;
      });

      await convertLatexSource(id, outputPath, tempDir);

      expect(tex4ebookCalled).toBe(true);
      expect(pandocCalled).toBe(true);
    });

    it('throws DependencyError when neither tool is installed', async () => {
      mockExeca.mockImplementation(async (cmd: string) => {
        if (cmd === 'tex4ebook' || cmd === 'pandoc') {
          throw new Error('command not found');
        }
        return {} as any;
      });

      await expect(convertLatexSource(id, outputPath, tempDir)).rejects.toThrow(
        DependencyError
      );
    });

    it('throws LatexConversionError when pandoc fails', async () => {
      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'tex4ebook' && args?.[0]?.endsWith('.tex')) {
          throw new Error('tex4ebook failed');
        }
        if (cmd === 'pandoc') {
          throw new Error('pandoc conversion failed');
        }
        return {} as any;
      });

      await expect(convertLatexSource(id, outputPath, tempDir)).rejects.toThrow(
        LatexConversionError
      );
    });

    it('successfully converts and moves epub to output path', async () => {
      mockPathExists.mockImplementation(async (path: string) => {
        if (typeof path === 'string') {
          if (path.endsWith('.tex')) return true;
          if (path.endsWith('.epub')) return true;
        }
        return false;
      });

      await convertLatexSource(id, outputPath, tempDir);

      expect(mockMove).toHaveBeenCalledWith(
        expect.stringContaining('.epub'),
        outputPath,
        { overwrite: true }
      );
    });
  });
});
