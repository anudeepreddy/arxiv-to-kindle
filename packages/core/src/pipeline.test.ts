import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  convertArxivToEpub,
  type ConversionOptions,
  type ConversionResult,
} from './pipeline.js';
import { normalizeArxivId } from './id-parser.js';
import { probeAvailability } from './probe.js';
import { fetchHtml } from './fetcher.js';
import { sanitizeScripts } from './cleaner.js';
import { resolveImageUrls } from './image-resolver.js';
import { downloadImages } from './image-downloader.js';
import { prepareForPandoc } from './pandoc-prep.js';
import { runPandoc } from './pandoc.js';
import { convertLatexSource } from './latex-fallback.js';
import { injectMetadata } from './epub-meta.js';
import { checkDependencies } from './preflight.js';
import { PandocNotInstalledError, InvalidIdError } from './errors.js';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('./id-parser.js');
vi.mock('./probe.js');
vi.mock('./fetcher.js');
vi.mock('./cleaner.js');
vi.mock('./image-resolver.js');
vi.mock('./image-downloader.js');
vi.mock('./pandoc-prep.js');
vi.mock('./pandoc.js');
vi.mock('./latex-fallback.js');
vi.mock('./epub-meta.js');
vi.mock('./preflight.js');
vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
    pathExists: vi.fn().mockResolvedValue(true),
    remove: vi.fn(),
  },
}));

const mockNormalizeArxivId = vi.mocked(normalizeArxivId);
const mockProbeAvailability = vi.mocked(probeAvailability);
const mockFetchHtml = vi.mocked(fetchHtml);
const mockSanitizeScripts = vi.mocked(sanitizeScripts);
const mockResolveImageUrls = vi.mocked(resolveImageUrls);
const mockDownloadImages = vi.mocked(downloadImages);
const mockPrepareForPandoc = vi.mocked(prepareForPandoc);
const mockRunPandoc = vi.mocked(runPandoc);
const mockConvertLatexSource = vi.mocked(convertLatexSource);
const mockInjectMetadata = vi.mocked(injectMetadata);
const mockCheckDependencies = vi.mocked(checkDependencies);

describe('convertArxivToEpub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNormalizeArxivId.mockReturnValue({ id: '2301.12345' });
    mockFetchHtml.mockResolvedValue('<html><body>Test</body></html>');
    mockSanitizeScripts.mockReturnValue('<html><body>Sanitized</body></html>');
    mockResolveImageUrls.mockReturnValue({
      cleanedHtml: '<html><body>Resolved</body></html>',
      imageUrls: [],
    });
    mockDownloadImages.mockResolvedValue([]);
    mockPrepareForPandoc.mockReturnValue('<!DOCTYPE html><html><body>Prepared</body></html>');
    mockRunPandoc.mockResolvedValue(undefined);
    mockConvertLatexSource.mockResolvedValue(undefined);
    mockInjectMetadata.mockResolvedValue(undefined);
    mockCheckDependencies.mockResolvedValue({ pandoc: true, tex4ebook: true, errors: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Test 1: ID with HTML -> Uses HTML route, skips LaTeX', () => {
    it('should use HTML route when HTML is available', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });

      const result = await convertArxivToEpub('2301.12345', '/output/test.epub');

      expect(result.format).toBe('html');
      expect(mockFetchHtml).toHaveBeenCalledWith('https://arxiv.org/html/2301.12345');
      expect(mockSanitizeScripts).toHaveBeenCalled();
      expect(mockResolveImageUrls).toHaveBeenCalled();
      expect(mockPrepareForPandoc).toHaveBeenCalled();
      expect(mockRunPandoc).toHaveBeenCalled();
      expect(mockConvertLatexSource).not.toHaveBeenCalled();
    });

    it('should use ar5iv route when ar5iv is available', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'ar5iv', url: 'https://ar5iv.org/html/2301.12345' });

      const result = await convertArxivToEpub('2301.12345', '/output/test.epub');

      expect(result.format).toBe('ar5iv');
      expect(mockFetchHtml).toHaveBeenCalledWith('https://ar5iv.org/html/2301.12345');
      expect(mockRunPandoc).toHaveBeenCalled();
      expect(mockConvertLatexSource).not.toHaveBeenCalled();
    });
  });

  describe('Test 2: ID without HTML but with LaTeX -> Uses LaTeX route', () => {
    it('should use LaTeX route when only LaTeX source is available', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'latex', url: 'https://arxiv.org/e-print/2301.12345' });

      const result = await convertArxivToEpub('2301.12345', '/output/test.epub');

      expect(result.format).toBe('latex');
      expect(mockConvertLatexSource).toHaveBeenCalled();
      expect(mockFetchHtml).not.toHaveBeenCalled();
      expect(mockRunPandoc).not.toHaveBeenCalled();
    });
  });

  describe('Test 3: Calls onProgress with stages', () => {
    it('should call onProgress with expected stages for HTML route', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      const onProgress = vi.fn();

      await convertArxivToEpub('2301.12345', '/output/test.epub', { onProgress });

      expect(onProgress).toHaveBeenCalledWith('probing', 'Checking available formats...');
      expect(onProgress).toHaveBeenCalledWith('fetching', 'Downloading HTML...');
      expect(onProgress).toHaveBeenCalledWith('cleaning', 'Sanitizing HTML...');
      expect(onProgress).toHaveBeenCalledWith('converting', 'Converting to EPUB...');
      expect(onProgress).toHaveBeenCalledWith('metadata', 'Adding metadata...');
      expect(onProgress).toHaveBeenCalledWith('complete', 'Done!');
    });

    it('should call onProgress with expected stages for LaTeX route', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'latex', url: 'https://arxiv.org/e-print/2301.12345' });
      const onProgress = vi.fn();

      await convertArxivToEpub('2301.12345', '/output/test.epub', { onProgress });

      expect(onProgress).toHaveBeenCalledWith('probing', 'Checking available formats...');
      expect(onProgress).toHaveBeenCalledWith('latex', 'Converting from LaTeX source...');
      expect(onProgress).toHaveBeenCalledWith('metadata', 'Adding metadata...');
      expect(onProgress).toHaveBeenCalledWith('complete', 'Done!');
    });
  });

  describe('Test 4: Invalid ID throws appropriate error', () => {
    it('should throw InvalidIdError for invalid arXiv ID', async () => {
      mockNormalizeArxivId.mockReturnValue(null);

      await expect(convertArxivToEpub('invalid-id', '/output/test.epub')).rejects.toThrow(InvalidIdError);
    });

    it('should throw InvalidIdError for empty string', async () => {
      mockNormalizeArxivId.mockReturnValue(null);

      await expect(convertArxivToEpub('', '/output/test.epub')).rejects.toThrow(InvalidIdError);
    });
  });

  describe('Test 5: Options are passed through correctly', () => {
    it('should pass preferMathml option to pandoc', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });

      await convertArxivToEpub('2301.12345', '/output/test.epub', { preferMathml: true });

      expect(mockRunPandoc).toHaveBeenCalledWith(
        expect.any(String),
        '/output/test.epub',
        expect.objectContaining({ mathFormat: 'mathml' })
      );
    });

    it('should pass preferMathml=false as svg to pandoc', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });

      await convertArxivToEpub('2301.12345', '/output/test.epub', { preferMathml: false });

      expect(mockRunPandoc).toHaveBeenCalledWith(
        expect.any(String),
        '/output/test.epub',
        expect.objectContaining({ mathFormat: 'svg' })
      );
    });

    it('should default preferMathml to true', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });

      await convertArxivToEpub('2301.12345', '/output/test.epub');

      expect(mockRunPandoc).toHaveBeenCalledWith(
        expect.any(String),
        '/output/test.epub',
        expect.objectContaining({ mathFormat: 'mathml' })
      );
    });

    it('should pass metadata to injectMetadata', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      const metadata = {
        title: 'Test Paper',
        authors: ['Author One', 'Author Two'],
        abstract: 'This is a test abstract.',
        subjects: ['Computer Science', 'Machine Learning'],
      };

      await convertArxivToEpub('2301.12345', '/output/test.epub', { metadata });

      expect(mockInjectMetadata).toHaveBeenCalledWith(
        '/output/test.epub',
        expect.objectContaining({
          title: 'Test Paper',
          authors: ['Author One', 'Author Two'],
          abstract: 'This is a test abstract.',
          subjects: ['Computer Science', 'Machine Learning'],
          arxivId: '2301.12345',
        })
      );
    });

    it('should use default metadata when not provided', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });

      await convertArxivToEpub('2301.12345', '/output/test.epub');

      expect(mockInjectMetadata).toHaveBeenCalledWith(
        '/output/test.epub',
        expect.objectContaining({
          title: 'arXiv:2301.12345',
          authors: [],
          abstract: '',
          subjects: [],
          arxivId: '2301.12345',
        })
      );
    });
  });

  describe('Version handling', () => {
    it('should include version in ID string when version is present', async () => {
      mockNormalizeArxivId.mockReturnValue({ id: '2301.12345', version: 2 });
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345v2' });

      await convertArxivToEpub('2301.12345v2', '/output/test.epub');

      expect(mockProbeAvailability).toHaveBeenCalledWith('2301.12345v2');
      expect(mockInjectMetadata).toHaveBeenCalledWith(
        '/output/test.epub',
        expect.objectContaining({ arxivId: '2301.12345v2' })
      );
    });
  });

  describe('PDF fallback', () => {
    it('should throw error for PDF fallback', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'pdf', url: 'https://arxiv.org/pdf/2301.12345' });

      await expect(convertArxivToEpub('2301.12345', '/output/test.epub')).rejects.toThrow(
        'PDF fallback not implemented for arXiv:2301.12345. Manual conversion required.'
      );
    });
  });

  describe('Image handling', () => {
    it('should download and process images when present', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      mockResolveImageUrls.mockReturnValue({
        cleanedHtml: '<html><body><img src="https://example.com/image1.png"/></body></html>',
        imageUrls: ['https://example.com/image1.png', 'https://example.com/image2.png'],
      });
      mockDownloadImages.mockResolvedValue([
        { originalUrl: 'https://example.com/image1.png', localPath: '/tmp/img1.png', success: true },
        { originalUrl: 'https://example.com/image2.png', localPath: '/tmp/img2.png', success: true },
      ]);

      await convertArxivToEpub('2301.12345', '/output/test.epub');

      expect(mockDownloadImages).toHaveBeenCalledWith(
        ['https://example.com/image1.png', 'https://example.com/image2.png'],
        expect.any(String)
      );
      expect(mockPrepareForPandoc).toHaveBeenCalledWith(
        expect.any(String),
        [
          { url: 'https://example.com/image1.png', localPath: '/tmp/img1.png' },
          { url: 'https://example.com/image2.png', localPath: '/tmp/img2.png' },
        ],
        '2301.12345'
      );
    });

    it('should skip image download when no images', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      mockResolveImageUrls.mockReturnValue({
        cleanedHtml: '<html><body>No images</body></html>',
        imageUrls: [],
      });

      await convertArxivToEpub('2301.12345', '/output/test.epub');

      expect(mockDownloadImages).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up temp directory after success', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      const mockedRemove = vi.mocked(fs.remove);

      await convertArxivToEpub('2301.12345', '/output/test.epub');

      expect(mockedRemove).toHaveBeenCalled();
    });

    it('should clean up temp directory after error', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      mockFetchHtml.mockRejectedValue(new Error('Network error'));
      const mockedRemove = vi.mocked(fs.remove);

      await expect(convertArxivToEpub('2301.12345', '/output/test.epub')).rejects.toThrow();

      expect(mockedRemove).toHaveBeenCalled();
    });
  });

  describe('Preflight checks', () => {
    it('should throw PandocNotInstalledError when pandoc is not available', async () => {
      mockCheckDependencies.mockResolvedValue({ pandoc: false, tex4ebook: false, errors: ['Pandoc not found'] });

      await expect(convertArxivToEpub('2301.12345', '/output/test.epub')).rejects.toThrow(PandocNotInstalledError);
    });

    it('should skip preflight check when skipPreflight is true', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      mockCheckDependencies.mockResolvedValue({ pandoc: false, tex4ebook: false, errors: ['Pandoc not found'] });

      const result = await convertArxivToEpub('2301.12345', '/output/test.epub', { skipPreflight: true });

      expect(result.format).toBe('html');
      expect(mockCheckDependencies).not.toHaveBeenCalled();
    });

    it('should call onProgress with preflight stage', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      const onProgress = vi.fn();

      await convertArxivToEpub('2301.12345', '/output/test.epub', { onProgress });

      expect(onProgress).toHaveBeenCalledWith('preflight', 'Checking dependencies...');
    });

    it('should not call onProgress with preflight when skipPreflight is true', async () => {
      mockProbeAvailability.mockResolvedValue({ type: 'html', url: 'https://arxiv.org/html/2301.12345' });
      const onProgress = vi.fn();

      await convertArxivToEpub('2301.12345', '/output/test.epub', { onProgress, skipPreflight: true });

      expect(onProgress).not.toHaveBeenCalledWith('preflight', 'Checking dependencies...');
    });
  });
});
