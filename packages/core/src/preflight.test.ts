import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import { checkDependencies } from './preflight.js';

vi.mock('execa');

describe('checkDependencies', () => {
  const mockExeca = vi.mocked(execa);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns true for pandoc when pandoc is available', async () => {
    mockExeca.mockResolvedValue({ stdout: 'pandoc 3.1.0' } as never);

    const result = await checkDependencies();

    expect(result.pandoc).toBe(true);
    expect(mockExeca).toHaveBeenCalledWith('pandoc', ['--version']);
  });

  it('returns false for pandoc when pandoc is not available', async () => {
    mockExeca.mockRejectedValueOnce(new Error('command not found: pandoc'));
    mockExeca.mockResolvedValue({ stdout: 'tex4ebook' } as never);

    const result = await checkDependencies();

    expect(result.pandoc).toBe(false);
  });

  it('returns true for tex4ebook when tex4ebook is available', async () => {
    mockExeca.mockResolvedValue({ stdout: 'tex4ebook' } as never);

    const result = await checkDependencies();

    expect(result.tex4ebook).toBe(true);
    expect(mockExeca).toHaveBeenCalledWith('tex4ebook', ['--version']);
  });

  it('returns false for tex4ebook when tex4ebook is not available', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: 'pandoc 3.1.0' } as never);
    mockExeca.mockRejectedValueOnce(new Error('command not found: tex4ebook'));

    const result = await checkDependencies();

    expect(result.tex4ebook).toBe(false);
  });

  it('collects error messages for missing dependencies', async () => {
    mockExeca.mockRejectedValue(new Error('command not found'));

    const result = await checkDependencies();

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('Pandoc not found');
    expect(result.errors[1]).toContain('tex4ebook not found');
  });

  it('returns empty errors array when all dependencies are available', async () => {
    mockExeca.mockResolvedValue({ stdout: 'version' } as never);

    const result = await checkDependencies();

    expect(result.errors).toHaveLength(0);
  });

  it('handles both dependencies available', async () => {
    mockExeca.mockResolvedValue({ stdout: 'version' } as never);

    const result = await checkDependencies();

    expect(result.pandoc).toBe(true);
    expect(result.tex4ebook).toBe(true);
  });

  it('handles both dependencies missing', async () => {
    mockExeca.mockRejectedValue(new Error('command not found'));

    const result = await checkDependencies();

    expect(result.pandoc).toBe(false);
    expect(result.tex4ebook).toBe(false);
  });

  it('includes install URLs in error messages', async () => {
    mockExeca.mockRejectedValue(new Error('command not found'));

    const result = await checkDependencies();

    expect(result.errors[0]).toContain('https://pandoc.org/installing.html');
    expect(result.errors[1]).toContain('https://github.com/michal-h21/tex4ebook');
  });
});
