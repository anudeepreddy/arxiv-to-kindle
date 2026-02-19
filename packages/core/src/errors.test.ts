import { describe, it, expect } from 'vitest';
import {
  NotFoundError,
  FetchError,
  PandocError,
  LatexConversionError,
  DependencyError,
  ArxivNotFoundError,
  PandocNotInstalledError,
  Tex4ebookNotInstalledError,
  ConversionTimeoutError,
  InvalidIdError,
} from './errors.js';

describe('Error classes', () => {
  describe('NotFoundError', () => {
    it('creates error with URL in message', () => {
      const error = new NotFoundError('https://example.com/test');
      expect(error.message).toBe('Resource not found: https://example.com/test');
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('FetchError', () => {
    it('creates error with message', () => {
      const error = new FetchError('Network failed');
      expect(error.message).toBe('Network failed');
      expect(error.name).toBe('FetchError');
    });

    it('creates error with cause', () => {
      const cause = new Error('Original error');
      const error = new FetchError('Network failed', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('PandocError', () => {
    it('creates error with exit code and stderr', () => {
      const error = new PandocError('Pandoc failed', 1, 'Invalid input');
      expect(error.message).toBe('Pandoc failed');
      expect(error.name).toBe('PandocError');
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe('Invalid input');
    });
  });

  describe('LatexConversionError', () => {
    it('creates error with message', () => {
      const error = new LatexConversionError('LaTeX compilation failed');
      expect(error.message).toBe('LaTeX compilation failed');
      expect(error.name).toBe('LatexConversionError');
    });

    it('creates error with cause', () => {
      const cause = new Error('Original error');
      const error = new LatexConversionError('LaTeX compilation failed', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('DependencyError', () => {
    it('creates error with message', () => {
      const error = new DependencyError('Missing dependency');
      expect(error.message).toBe('Missing dependency');
      expect(error.name).toBe('DependencyError');
    });
  });

  describe('ArxivNotFoundError', () => {
    it('creates error with arXiv ID in message', () => {
      const error = new ArxivNotFoundError('2301.12345');
      expect(error.message).toBe('Paper not found on arXiv: 2301.12345');
      expect(error.name).toBe('ArxivNotFoundError');
    });
  });

  describe('PandocNotInstalledError', () => {
    it('creates error with install URL', () => {
      const error = new PandocNotInstalledError();
      expect(error.message).toContain('Pandoc not found');
      expect(error.message).toContain('https://pandoc.org/installing.html');
      expect(error.name).toBe('PandocNotInstalledError');
    });

    it('extends DependencyError', () => {
      const error = new PandocNotInstalledError();
      expect(error).toBeInstanceOf(DependencyError);
    });
  });

  describe('Tex4ebookNotInstalledError', () => {
    it('creates error with install URL', () => {
      const error = new Tex4ebookNotInstalledError();
      expect(error.message).toContain('tex4ebook not found');
      expect(error.message).toContain('https://github.com/michal-h21/tex4ebook');
      expect(error.name).toBe('Tex4ebookNotInstalledError');
    });

    it('extends DependencyError', () => {
      const error = new Tex4ebookNotInstalledError();
      expect(error).toBeInstanceOf(DependencyError);
    });
  });

  describe('ConversionTimeoutError', () => {
    it('creates error with timeout in message', () => {
      const error = new ConversionTimeoutError(30000);
      expect(error.message).toBe('Conversion timed out after 30000ms');
      expect(error.name).toBe('ConversionTimeoutError');
    });
  });

  describe('InvalidIdError', () => {
    it('creates error with input in message', () => {
      const error = new InvalidIdError('invalid-id');
      expect(error.message).toBe('Invalid arXiv ID: invalid-id');
      expect(error.name).toBe('InvalidIdError');
    });
  });
});
