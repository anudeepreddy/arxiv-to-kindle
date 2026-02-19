import { describe, it, expect } from 'vitest';
import { normalizeArxivId } from './id-parser';

describe('normalizeArxivId', () => {
  describe('new format (YYMM.NNNNN)', () => {
    it('parses simple new format ID', () => {
      const result = normalizeArxivId('2401.12345');
      expect(result).toEqual({ id: '2401.12345' });
    });

    it('parses new format ID with version', () => {
      const result = normalizeArxivId('2401.12345v2');
      expect(result).toEqual({ id: '2401.12345', version: 2 });
    });

    it('parses new format ID with version 1', () => {
      const result = normalizeArxivId('2401.12345v1');
      expect(result).toEqual({ id: '2401.12345', version: 1 });
    });

    it('parses new format ID with high version number', () => {
      const result = normalizeArxivId('2401.12345v10');
      expect(result).toEqual({ id: '2401.12345', version: 10 });
    });

    it('parses 4-digit suffix (older new format)', () => {
      const result = normalizeArxivId('1501.0001');
      expect(result).toEqual({ id: '1501.0001' });
    });

    it('parses 5-digit suffix', () => {
      const result = normalizeArxivId('2301.12345');
      expect(result).toEqual({ id: '2301.12345' });
    });
  });

  describe('old format (category/YYMMNNN)', () => {
    it('parses old format ID', () => {
      const result = normalizeArxivId('hep-th/9802150');
      expect(result).toEqual({ 
        id: 'hep-th/9802150', 
        category: 'hep-th' 
      });
    });

    it('parses old format ID with version', () => {
      const result = normalizeArxivId('hep-th/9802150v2');
      expect(result).toEqual({ 
        id: 'hep-th/9802150', 
        category: 'hep-th',
        version: 2 
      });
    });

    it('parses cs category', () => {
      const result = normalizeArxivId('cs/0112017');
      expect(result).toEqual({ 
        id: 'cs/0112017', 
        category: 'cs' 
      });
    });

    it('parses math category', () => {
      const result = normalizeArxivId('math/0309135');
      expect(result).toEqual({ 
        id: 'math/0309135', 
        category: 'math' 
      });
    });

    it('parses physics category', () => {
      const result = normalizeArxivId('physics/9705021');
      expect(result).toEqual({ 
        id: 'physics/9705021', 
        category: 'physics' 
      });
    });

    it('parses quant-ph category', () => {
      const result = normalizeArxivId('quant-ph/9802150');
      expect(result).toEqual({ 
        id: 'quant-ph/9802150', 
        category: 'quant-ph' 
      });
    });
  });

  describe('URL extraction', () => {
    it('extracts ID from abs URL', () => {
      const result = normalizeArxivId('https://arxiv.org/abs/2401.12345');
      expect(result).toEqual({ id: '2401.12345' });
    });

    it('extracts ID from html URL', () => {
      const result = normalizeArxivId('https://arxiv.org/html/2401.12345');
      expect(result).toEqual({ id: '2401.12345' });
    });

    it('extracts ID from pdf URL', () => {
      const result = normalizeArxivId('https://arxiv.org/pdf/2401.12345');
      expect(result).toEqual({ id: '2401.12345' });
    });

    it('extracts ID from src URL', () => {
      const result = normalizeArxivId('https://arxiv.org/src/2401.12345');
      expect(result).toEqual({ id: '2401.12345' });
    });

    it('extracts old format ID from URL', () => {
      const result = normalizeArxivId('arxiv.org/abs/hep-th/9802150');
      expect(result).toEqual({ 
        id: 'hep-th/9802150', 
        category: 'hep-th' 
      });
    });

    it('extracts ID from URL with version', () => {
      const result = normalizeArxivId('https://arxiv.org/abs/2401.12345v2');
      expect(result).toEqual({ id: '2401.12345', version: 2 });
    });
  });

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(normalizeArxivId('')).toBeNull();
    });

    it('returns null for whitespace only', () => {
      expect(normalizeArxivId('   ')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(normalizeArxivId(null as unknown as string)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(normalizeArxivId(undefined as unknown as string)).toBeNull();
    });

    it('returns null for invalid string', () => {
      expect(normalizeArxivId('invalid')).toBeNull();
    });

    it('returns null for malformed ID', () => {
      expect(normalizeArxivId('12345')).toBeNull();
    });

    it('returns null for wrong date format', () => {
      expect(normalizeArxivId('2401.123')).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(normalizeArxivId(12345 as unknown as string)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('trims whitespace from input', () => {
      const result = normalizeArxivId('  2401.12345  ');
      expect(result).toEqual({ id: '2401.12345' });
    });

    it('handles mixed case URL', () => {
      const result = normalizeArxivId('HTTPS://ARXIV.ORG/ABS/2401.12345');
      expect(result).toEqual({ id: '2401.12345' });
    });
  });
});
