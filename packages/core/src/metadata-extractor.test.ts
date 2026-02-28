import { describe, it, expect } from 'vitest';
import { extractMetadata, sanitizeFilename } from './metadata-extractor.js';

describe('extractMetadata', () => {
  it('should extract title from document', () => {
    const html = `
      <html>
        <body>
          <h1 class="ltx_title ltx_title_document">Test Paper Title</h1>
        </body>
      </html>
    `;
    const result = extractMetadata(html);
    expect(result.title).toBe('Test Paper Title');
  });

  it('should fallback to h1 if ltx_title not found', () => {
    const html = `
      <html>
        <body>
          <h1>Simple Title</h1>
        </body>
      </html>
    `;
    const result = extractMetadata(html);
    expect(result.title).toBe('Simple Title');
  });

  it('should extract authors from ltx_personname', () => {
    const html = `
      <html>
        <body>
          <span class="ltx_personname">John Doe<sup>1</sup>  Jane Smith<sup>2</sup></span>
        </body>
      </html>
    `;
    const result = extractMetadata(html);
    expect(result.authors).toContain('John Doe');
    expect(result.authors).toContain('Jane Smith');
  });

  it('should extract abstract', () => {
    const html = `
      <html>
        <body>
          <div class="ltx_abstract">
            <h6 class="ltx_title ltx_title_abstract">Abstract.</h6>
            <p>This is the abstract text.</p>
          </div>
        </body>
      </html>
    `;
    const result = extractMetadata(html);
    expect(result.abstract).toContain('This is the abstract text');
    expect(result.abstract).not.toContain('Abstract.');
  });

  it('should return empty values for minimal HTML', () => {
    const html = '<html><body></body></html>';
    const result = extractMetadata(html);
    expect(result.title).toBe('');
    expect(result.authors).toEqual([]);
    expect(result.abstract).toBe('');
    expect(result.subjects).toEqual([]);
  });
});

describe('sanitizeFilename', () => {
  it('should remove illegal characters', () => {
    expect(sanitizeFilename('Title: Subtitle')).toBe('Title Subtitle');
    expect(sanitizeFilename('A/B Testing')).toBe('AB Testing');
    expect(sanitizeFilename('File*Name')).toBe('FileName');
  });

  it('should normalize whitespace', () => {
    expect(sanitizeFilename('Multiple   Spaces')).toBe('Multiple Spaces');
    expect(sanitizeFilename('  Trimmed  ')).toBe('Trimmed');
  });

  it('should limit length', () => {
    const longTitle = 'A'.repeat(200);
    expect(sanitizeFilename(longTitle).length).toBeLessThanOrEqual(100);
  });

  it('should handle empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });
});
