import { describe, it, expect } from 'vitest';
import { resolveImageUrls } from './image-resolver';

describe('resolveImageUrls', () => {
  it('resolves relative URLs starting with /', () => {
    const input = '<img src="/src/2401.12345/figure1.png">';
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toContain('https://arxiv.org/src/2401.12345/figure1.png');
    expect(result.cleanedHtml).toContain('src="https://arxiv.org/src/2401.12345/figure1.png"');
  });

  it('preserves data URIs and does not include them in imageUrls', () => {
    const input = '<img src="data:image/png;base64,iVBORw0KGgo...">';
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toHaveLength(0);
    expect(result.cleanedHtml).toContain('src="data:image/png;base64,iVBORw0KGgo..."');
  });

  it('resolves multiple images correctly', () => {
    const input = `
      <img src="/src/2401.12345/figure1.png">
      <img src="/src/2401.12345/figure2.png">
      <img src="https://example.com/external.png">
    `;
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toHaveLength(3);
    expect(result.imageUrls).toContain('https://arxiv.org/src/2401.12345/figure1.png');
    expect(result.imageUrls).toContain('https://arxiv.org/src/2401.12345/figure2.png');
    expect(result.imageUrls).toContain('https://example.com/external.png');
  });

  it('resolves relative paths with ./', () => {
    const input = '<img src="./images/fig1.png">';
    const baseUrl = 'https://arxiv.org/html/2401.12345/';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toContain('https://arxiv.org/html/2401.12345/images/fig1.png');
    expect(result.cleanedHtml).toContain('src="https://arxiv.org/html/2401.12345/images/fig1.png"');
  });

  it('keeps already absolute URLs as-is', () => {
    const input = '<img src="https://example.com/image.png">';
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toContain('https://example.com/image.png');
    expect(result.cleanedHtml).toContain('src="https://example.com/image.png"');
  });

  it('handles http:// URLs', () => {
    const input = '<img src="http://example.com/image.png">';
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toContain('http://example.com/image.png');
    expect(result.cleanedHtml).toContain('src="http://example.com/image.png"');
  });

  it('handles mixed data URIs and regular URLs', () => {
    const input = `
      <img src="/src/2401.12345/figure1.png">
      <img src="data:image/png;base64,iVBORw0KGgo...">
      <img src="https://example.com/external.png">
    `;
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toHaveLength(2);
    expect(result.imageUrls).toContain('https://arxiv.org/src/2401.12345/figure1.png');
    expect(result.imageUrls).toContain('https://example.com/external.png');
    expect(result.cleanedHtml).toContain('src="data:image/png;base64,iVBORw0KGgo..."');
  });

  it('returns unique URLs for duplicate images', () => {
    const input = `
      <img src="/src/2401.12345/figure1.png">
      <img src="/src/2401.12345/figure1.png">
    `;
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toHaveLength(1);
    expect(result.imageUrls).toContain('https://arxiv.org/src/2401.12345/figure1.png');
  });

  it('handles images without src attribute', () => {
    const input = '<img alt="missing image">';
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toHaveLength(0);
  });

  it('handles empty HTML', () => {
    const input = '';
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.imageUrls).toHaveLength(0);
    expect(result.cleanedHtml).toContain('<html');
  });

  it('preserves other img attributes', () => {
    const input = '<img src="/src/2401.12345/figure1.png" alt="Figure 1" class="figure">';
    const baseUrl = 'https://arxiv.org/html/2401.12345';
    const result = resolveImageUrls(input, baseUrl);

    expect(result.cleanedHtml).toContain('alt="Figure 1"');
    expect(result.cleanedHtml).toContain('class="figure"');
  });
});
