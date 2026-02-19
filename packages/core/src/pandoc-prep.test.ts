import { describe, it, expect } from 'vitest';
import { prepareForPandoc, type ImageMapping } from './pandoc-prep';

describe('prepareForPandoc', () => {
  describe('image URL replacement', () => {
    it('replaces image URL with local relative path', () => {
      const input = '<html><body><img src="https://arxiv.org/src/12345/v1/fig1.png"></body></html>';
      const imageMapping: ImageMapping[] = [
        { url: 'https://arxiv.org/src/12345/v1/fig1.png', localPath: '/tmp/xyz/abc123.png' }
      ];
      
      const result = prepareForPandoc(input, imageMapping);
      
      expect(result).toContain('src="./images/abc123.png"');
      expect(result).not.toContain('https://arxiv.org/src');
    });

    it('replaces multiple image URLs with correct local paths', () => {
      const input = `<html><body>
        <img src="https://arxiv.org/src/12345/v1/fig1.png">
        <img src="https://arxiv.org/src/12345/v1/fig2.png">
        <img src="https://arxiv.org/src/12345/v1/diagram.jpg">
      </body></html>`;
      const imageMapping: ImageMapping[] = [
        { url: 'https://arxiv.org/src/12345/v1/fig1.png', localPath: '/tmp/a/img1.png' },
        { url: 'https://arxiv.org/src/12345/v1/fig2.png', localPath: '/tmp/b/img2.png' },
        { url: 'https://arxiv.org/src/12345/v1/diagram.jpg', localPath: '/tmp/c/diagram.jpg' }
      ];
      
      const result = prepareForPandoc(input, imageMapping);
      
      expect(result).toContain('src="./images/img1.png"');
      expect(result).toContain('src="./images/img2.png"');
      expect(result).toContain('src="./images/diagram.jpg"');
    });

    it('does not change images when imageMapping is empty', () => {
      const input = '<html><body><img src="https://arxiv.org/src/12345/v1/fig1.png"></body></html>';
      const imageMapping: ImageMapping[] = [];
      
      const result = prepareForPandoc(input, imageMapping);
      
      expect(result).toContain('src="https://arxiv.org/src/12345/v1/fig1.png"');
    });

    it('does not change image if URL is not in mapping', () => {
      const input = '<html><body><img src="https://arxiv.org/src/12345/v1/fig1.png"></body></html>';
      const imageMapping: ImageMapping[] = [
        { url: 'https://arxiv.org/src/99999/v1/other.png', localPath: '/tmp/xyz/other.png' }
      ];
      
      const result = prepareForPandoc(input, imageMapping);
      
      expect(result).toContain('src="https://arxiv.org/src/12345/v1/fig1.png"');
    });
  });

  describe('MathML handling', () => {
    it('preserves MathML elements', () => {
      const input = '<html><body><math><mi>x</mi><mo>+</mo><mi>y</mi></math></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result).toContain('<math');
      expect(result).toContain('<mi>x</mi>');
      expect(result).toContain('<mo>+</mo>');
      expect(result).toContain('<mi>y</mi>');
      expect(result).toContain('</math>');
    });

    it('wraps standalone MathML in div for Pandoc compatibility', () => {
      const input = '<html><body><p><math><mi>x</mi></math></p></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result).toContain('<math');
      expect(result).toContain('class="ltx_math"');
    });

    it('preserves complex MathML with mrow, mfrac, etc', () => {
      const input = `<html><body>
        <math>
          <mrow>
            <mfrac>
              <mi>a</mi>
              <mi>b</mi>
            </mfrac>
          </mrow>
        </math>
      </body></html>`;
      const result = prepareForPandoc(input, []);
      
      expect(result).toContain('<math');
      expect(result).toContain('<mrow>');
      expect(result).toContain('<mfrac>');
      expect(result).toContain('<mi>a</mi>');
      expect(result).toContain('<mi>b</mi>');
      expect(result).toContain('</mfrac>');
      expect(result).toContain('</mrow>');
      expect(result).toContain('</math>');
    });
  });

  describe('document structure', () => {
    it('adds DOCTYPE if missing', () => {
      const input = '<html><body><p>Content</p></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result.toLowerCase()).toContain('<!doctype html>');
    });

    it('preserves existing DOCTYPE', () => {
      const input = '<!DOCTYPE html><html><body><p>Content</p></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result.toLowerCase()).toContain('<!doctype html>');
      const doctypeCount = (result.toLowerCase().match(/<!doctype/g) || []).length;
      expect(doctypeCount).toBe(1);
    });

    it('preserves html, head, body structure', () => {
      const input = '<html><head><title>Test</title></head><body><p>Content</p></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result).toContain('<html');
      expect(result).toContain('<head>');
      expect(result).toContain('<title>Test</title>');
      expect(result).toContain('<body>');
      expect(result).toContain('</body>');
      expect(result).toContain('</html>');
    });

    it('outputs well-formed HTML', () => {
      const input = '<html><body><p>Test</p><img src="https://example.com/img.png"></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result).toMatch(/<html[^>]*>/);
      expect(result).toContain('</html>');
      expect(result).toMatch(/<body[^>]*>/);
      expect(result).toContain('</body>');
    });
  });

  describe('arXiv-specific classes', () => {
    it('preserves ltx_equation classes', () => {
      const input = '<html><body><div class="ltx_equation"><math><mi>x</mi></math></div></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result).toContain('ltx_equation');
      expect(result).toContain('<math');
    });

    it('preserves other arXiv LaTeX classes', () => {
      const input = '<html><body><div class="ltx_document"><p class="ltx_p">Text</p></div></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result).toContain('ltx_document');
      expect(result).toContain('ltx_p');
    });
  });

  describe('combined operations', () => {
    it('handles both image replacement and MathML preservation', () => {
      const input = `<html><body>
        <img src="https://arxiv.org/src/123/v1/fig1.png">
        <math><mi>x</mi></math>
        <img src="https://arxiv.org/src/123/v1/fig2.png">
      </body></html>`;
      const imageMapping: ImageMapping[] = [
        { url: 'https://arxiv.org/src/123/v1/fig1.png', localPath: '/tmp/a/image1.png' },
        { url: 'https://arxiv.org/src/123/v1/fig2.png', localPath: '/tmp/b/image2.png' }
      ];
      
      const result = prepareForPandoc(input, imageMapping);
      
      expect(result).toContain('src="./images/image1.png"');
      expect(result).toContain('src="./images/image2.png"');
      expect(result).toContain('<math');
      expect(result).toContain('<mi>x</mi>');
      expect(result.toLowerCase()).toContain('<!doctype html>');
    });

    it('handles complex arXiv HTML document', () => {
      const input = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>arXiv Paper</title>
</head>
<body>
  <div class="ltx_document">
    <h1 class="ltx_title">Paper Title</h1>
    <div class="ltx_abstract">
      <p>Abstract text</p>
    </div>
    <div class="ltx_equation">
      <math><mrow><mi>E</mi><mo>=</mo><mrow><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow></mrow></math>
    </div>
    <figure class="ltx_figure">
      <img src="https://arxiv.org/src/12345/v1/figure1.png">
      <figcaption>Figure 1</figcaption>
    </figure>
  </div>
</body>
</html>`;
      const imageMapping: ImageMapping[] = [
        { url: 'https://arxiv.org/src/12345/v1/figure1.png', localPath: '/tmp/download/fig_001.png' }
      ];
      
      const result = prepareForPandoc(input, imageMapping);
      
      expect(result).toContain('src="./images/fig_001.png"');
      expect(result).toContain('<math');
      expect(result).toContain('ltx_equation');
      expect(result).toContain('ltx_document');
      expect(result).toContain('ltx_title');
      expect(result).toContain('ltx_abstract');
      expect(result).toContain('ltx_figure');
    });
  });

  describe('internal link conversion', () => {
    it('converts arxiv.org HTML links with anchors to internal anchors', () => {
      const input = '<html><body><a href="https://arxiv.org/html/2508.10146v1#S3.T2">Link</a></body></html>';
      const result = prepareForPandoc(input, [], '2508.10146');
      
      expect(result).toContain('href="#S3.T2"');
      expect(result).not.toContain('arxiv.org');
    });

    it('converts arxiv.org links with bib anchors', () => {
      const input = '<html><body><a href="https://arxiv.org/html/2508.10146v1#bib.bib13">Reference</a></body></html>';
      const result = prepareForPandoc(input, [], '2508.10146');
      
      expect(result).toContain('href="#bib.bib13"');
      expect(result).not.toContain('arxiv.org');
    });

    it('preserves external links like github', () => {
      const input = '<html><body><a href="https://github.com/user/repo">Code</a></body></html>';
      const result = prepareForPandoc(input, [], '2508.10146');
      
      expect(result).toContain('href="https://github.com/user/repo"');
    });

    it('preserves other external links', () => {
      const input = '<html><body><a href="https://example.com/page">External</a></body></html>';
      const result = prepareForPandoc(input, [], '2508.10146');
      
      expect(result).toContain('href="https://example.com/page"');
    });

    it('handles www.arxiv.org URLs', () => {
      const input = '<html><body><a href="https://www.arxiv.org/html/2508.10146v1#S2">Section</a></body></html>';
      const result = prepareForPandoc(input, [], '2508.10146');
      
      expect(result).toContain('href="#S2"');
    });

    it('handles multiple arxiv links in same document', () => {
      const input = `<html><body>
        <a href="https://arxiv.org/html/2508.10146v1#S1">Section 1</a>
        <a href="https://arxiv.org/html/2508.10146v1#S2.T1">Table</a>
        <a href="https://external.com">External</a>
      </body></html>`;
      const result = prepareForPandoc(input, [], '2508.10146');
      
      expect(result).toContain('href="#S1"');
      expect(result).toContain('href="#S2.T1"');
      expect(result).toContain('href="https://external.com"');
    });

    it('does not convert links when paperId is not provided', () => {
      const input = '<html><body><a href="https://arxiv.org/html/2508.10146v1#S3.T2">Link</a></body></html>';
      const result = prepareForPandoc(input, []);
      
      expect(result).toContain('href="https://arxiv.org/html/2508.10146v1#S3.T2"');
    });
  });
});
