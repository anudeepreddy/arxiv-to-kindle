import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import { pathExists } from 'fs-extra/esm';
import { runPandoc, type PandocOptions } from './pandoc';
import { PandocError } from './errors';

vi.mock('execa');
vi.mock('fs-extra/esm', () => ({
  pathExists: vi.fn(),
}));

describe('runPandoc', () => {
  const mockExeca = vi.mocked(execa);
  const mockPathExists = vi.mocked(pathExists);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathExists.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('executes pandoc with correct basic flags', async () => {
    mockExeca.mockResolvedValue({} as never);

    await runPandoc('/input/test.html', '/output/test.epub');

    expect(mockExeca).toHaveBeenCalledWith('pandoc', [
      '-f', 'html',
      '-t', 'epub3',
      '--standalone',
      '/input/test.html',
      '-o', '/output/test.epub',
    ]);
  });

  it('adds --mathml flag when mathFormat is mathml', async () => {
    mockExeca.mockResolvedValue({} as never);

    const options: PandocOptions = { mathFormat: 'mathml' };
    await runPandoc('/input/test.html', '/output/test.epub', options);

    const callArgs = mockExeca.mock.calls[0][1];
    expect(callArgs).toContain('--mathml');
  });

  it('adds --webtex flag when mathFormat is svg', async () => {
    mockExeca.mockResolvedValue({} as never);

    const options: PandocOptions = { mathFormat: 'svg' };
    await runPandoc('/input/test.html', '/output/test.epub', options);

    const callArgs = mockExeca.mock.calls[0][1];
    expect(callArgs).toContain('--webtex');
  });

  it('adds --toc flag when toc is true', async () => {
    mockExeca.mockResolvedValue({} as never);

    const options: PandocOptions = { toc: true };
    await runPandoc('/input/test.html', '/output/test.epub', options);

    const callArgs = mockExeca.mock.calls[0][1];
    expect(callArgs).toContain('--toc');
  });

  it('does not add --toc flag when toc is false', async () => {
    mockExeca.mockResolvedValue({} as never);

    const options: PandocOptions = { toc: false };
    await runPandoc('/input/test.html', '/output/test.epub', options);

    const callArgs = mockExeca.mock.calls[0][1];
    expect(callArgs).not.toContain('--toc');
  });

  it('adds metadata flags for each metadata entry', async () => {
    mockExeca.mockResolvedValue({} as never);

    const options: PandocOptions = {
      metadata: {
        title: 'Test Paper',
        author: 'John Doe',
      },
    };
    await runPandoc('/input/test.html', '/output/test.epub', options);

    const callArgs = mockExeca.mock.calls[0][1];
    expect(callArgs).toContain('--metadata');
    expect(callArgs).toContain('title=Test Paper');
    expect(callArgs).toContain('author=John Doe');
  });

  it('adds --resource-path when images directory exists', async () => {
    mockExeca.mockResolvedValue({} as never);
    mockPathExists.mockResolvedValue(true);

    await runPandoc('/input/test.html', '/output/test.epub');

    const callArgs = mockExeca.mock.calls[0][1];
    expect(callArgs).toContain('--resource-path');
    expect(callArgs).toContain('/input');
  });

  it('does not add --resource-path when images directory does not exist', async () => {
    mockExeca.mockResolvedValue({} as never);
    mockPathExists.mockResolvedValue(false);

    await runPandoc('/input/test.html', '/output/test.epub');

    const callArgs = mockExeca.mock.calls[0][1];
    expect(callArgs).not.toContain('--resource-path');
  });

  it('throws PandocError on non-zero exit code', async () => {
    const error = new Error('Command failed') as Error & { exitCode: number; stderr: string };
    error.exitCode = 1;
    error.stderr = 'Pandoc error: invalid input';
    mockExeca.mockRejectedValue(error);

    await expect(runPandoc('/input/test.html', '/output/test.epub')).rejects.toThrow(PandocError);
  });

  it('PandocError contains exit code and stderr', async () => {
    const error = new Error('Command failed') as Error & { exitCode: number; stderr: string };
    error.exitCode = 2;
    error.stderr = 'Pandoc stderr output';
    mockExeca.mockRejectedValue(error);

    try {
      await runPandoc('/input/test.html', '/output/test.epub');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PandocError);
      const pandocError = e as PandocError;
      expect(pandocError.exitCode).toBe(2);
      expect(pandocError.stderr).toBe('Pandoc stderr output');
    }
  });

  it('combines all options correctly', async () => {
    mockExeca.mockResolvedValue({} as never);
    mockPathExists.mockResolvedValue(true);

    const options: PandocOptions = {
      mathFormat: 'mathml',
      toc: true,
      metadata: {
        title: 'Test',
      },
    };
    await runPandoc('/input/test.html', '/output/test.epub', options);

    const callArgs = mockExeca.mock.calls[0][1];
    expect(callArgs).toContain('-f');
    expect(callArgs).toContain('html');
    expect(callArgs).toContain('-t');
    expect(callArgs).toContain('epub3');
    expect(callArgs).toContain('--standalone');
    expect(callArgs).toContain('--mathml');
    expect(callArgs).toContain('--toc');
    expect(callArgs).toContain('--metadata');
    expect(callArgs).toContain('title=Test');
    expect(callArgs).toContain('--resource-path');
    expect(callArgs).toContain('/input');
    expect(callArgs).toContain('/input/test.html');
    expect(callArgs).toContain('-o');
    expect(callArgs).toContain('/output/test.epub');
  });

  it('handles empty metadata object', async () => {
    mockExeca.mockResolvedValue({} as never);

    const options: PandocOptions = { metadata: {} };
    await runPandoc('/input/test.html', '/output/test.epub', options);

    const callArgs = mockExeca.mock.calls[0][1];
    const metadataIndex = callArgs.indexOf('--metadata');
    expect(metadataIndex).toBe(-1);
  });
});
