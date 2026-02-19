import { describe, it, expect } from 'vitest';
import { sanitizeScripts, removeTransformStyles } from './cleaner';

describe('removeTransformStyles', () => {
  it('removes style attribute containing transform', () => {
    const input = '<html><body><div style="transform: scale(0.805)">Content</div></body></html>';
    const result = removeTransformStyles(input);
    
    expect(result).not.toContain('transform');
    expect(result).toContain('Content');
  });

  it('removes style attribute containing translate', () => {
    const input = '<html><body><div style="translate(100px)">Content</div></body></html>';
    const result = removeTransformStyles(input);
    
    expect(result).not.toContain('translate');
    expect(result).toContain('Content');
  });

  it('removes style from ltx_transformed_inner class', () => {
    const input = '<html><body><div class="ltx_transformed_inner" style="width: 100px">Content</div></body></html>';
    const result = removeTransformStyles(input);
    
    expect(result).not.toContain('style');
    expect(result).toContain('ltx_transformed_inner');
    expect(result).toContain('Content');
  });

  it('removes style from ltx_transformed_outer class', () => {
    const input = '<html><body><div class="ltx_transformed_outer" style="height: 50px">Content</div></body></html>';
    const result = removeTransformStyles(input);
    
    expect(result).not.toContain('style');
    expect(result).toContain('ltx_transformed_outer');
    expect(result).toContain('Content');
  });

  it('preserves elements without transform styles', () => {
    const input = '<html><body><div style="color: red">Content</div></body></html>';
    const result = removeTransformStyles(input);
    
    expect(result).toContain('style="color: red"');
    expect(result).toContain('Content');
  });

  it('handles complex transform values', () => {
    const input = '<html><body><div style="transform: scale(0.805) translate(10px)">Content</div></body></html>';
    const result = removeTransformStyles(input);
    
    expect(result).not.toContain('transform');
    expect(result).not.toContain('scale');
    expect(result).toContain('Content');
  });

  it('handles empty input', () => {
    const result = removeTransformStyles('');
    expect(result).toContain('<html>');
  });
});

describe('sanitizeScripts', () => {
  it('removes script tags and their contents', () => {
    const input = '<html><body><script>alert("xss")</script><p>Content</p></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Content</p>');
  });

  it('removes style tags and their contents', () => {
    const input = '<html><head><style>body { color: red; }</style></head><body>Text</body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('<style>');
    expect(result).not.toContain('color: red');
    expect(result).toContain('Text');
  });

  it('removes arXiv experimental HTML warning banner', () => {
    const input = '<html><body><div class="ltx_note ltx_note_front">Experimental HTML warning</div><p>Content</p></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('ltx_note');
    expect(result).not.toContain('Experimental HTML warning');
    expect(result).toContain('<p>Content</p>');
  });

  it('removes elements with ltx_bibliography class', () => {
    const input = '<html><body><div class="ltx_bibliography">References</div><p>Content</p></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('ltx_bibliography');
    expect(result).not.toContain('References');
    expect(result).toContain('<p>Content</p>');
  });

  it('removes onclick event handler attributes', () => {
    const input = '<html><body><div onclick="alert(\'xss\')">Click</div></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
    expect(result).toContain('Click');
  });

  it('removes multiple event handler attributes', () => {
    const input = '<html><body><div onclick="a()" onload="b()" onerror="c()" onmouseover="d()">Content</div></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('Content');
  });

  it('removes javascript: URLs from href attributes', () => {
    const input = '<html><body><a href="javascript:alert(\'xss\')">Link</a></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('javascript:');
    expect(result).toContain('Link');
    expect(result).toContain('<a');
  });

  it('removes javascript: URLs with spaces and different case', () => {
    const input = '<html><body><a href="  JavaScript:void(0)">Link</a></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('JavaScript');
    expect(result).not.toContain('javascript');
    expect(result).toContain('Link');
  });

  it('preserves valid href attributes', () => {
    const input = '<html><body><a href="https://example.com">Link</a></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('Link');
  });

  it('preserves HTML structure after sanitization', () => {
    const input = '<html><head><title>Test</title></head><body><h1>Title</h1><p>Paragraph</p><ul><li>Item</li></ul></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).toContain('<html>');
    expect(result).toContain('<head>');
    expect(result).toContain('<title>Test</title>');
    expect(result).toContain('<body>');
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<p>Paragraph</p>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item</li>');
    expect(result).toContain('</body>');
    expect(result).toContain('</html>');
  });

  it('handles complex nested structures', () => {
    const input = `<html><body>
      <div class="container">
        <script>var x = 1;</script>
        <div class="content">
          <p onclick="bad()">Text</p>
          <a href="javascript:evil()">Link</a>
        </div>
        <style>.bad { display: none; }</style>
      </div>
    </body></html>`;
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<style>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('javascript:');
    expect(result).toContain('Text');
    expect(result).toContain('Link');
    expect(result).toContain('class="container"');
    expect(result).toContain('class="content"');
  });

  it('handles multiple script and style tags', () => {
    const input = `<html>
      <head>
        <style>body { margin: 0; }</style>
        <script>console.log('first');</script>
        <style>.hidden { display: none; }</style>
      </head>
      <body>
        <script>console.log('second');</script>
        <p>Content</p>
        <script>console.log('third');</script>
      </body>
    </html>`;
    const result = sanitizeScripts(input);
    
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<style>');
    expect(result).not.toContain('console.log');
    expect(result).not.toContain('margin');
    expect(result).toContain('<p>Content</p>');
  });

  it('handles empty input', () => {
    const result = sanitizeScripts('');
    expect(result).toContain('<html>');
    expect(result).toContain('<body>');
  });

  it('handles input with no elements to remove', () => {
    const input = '<html><body><p>Just plain content</p></body></html>';
    const result = sanitizeScripts(input);
    
    expect(result).toContain('<p>Just plain content</p>');
  });
});
