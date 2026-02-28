import * as cheerio from 'cheerio';

export interface ExtractedMetadata {
  title: string;
  authors: string[];
  abstract: string;
  subjects: string[];
}

export function extractMetadata(html: string): ExtractedMetadata {
  const $ = cheerio.load(html);

  // Extract title
  let title = '';
  const titleEl = $('.ltx_title.ltx_title_document').first();
  if (titleEl.length) {
    title = titleEl.text().trim().replace(/\s+/g, ' ');
  } else {
    const h1 = $('h1').first();
    if (h1.length) {
      title = h1.text().trim().replace(/\s+/g, ' ');
    }
  }

  // Extract authors
  const authors: string[] = [];
  const authorText: string[] = [];

  // Get all text from personname elements, including <br> handling
  $('.ltx_personname').each((_, el) => {
    // Replace <br> tags with newlines to separate authors
    const html = $(el).html() || '';
    const textWithNewlines = html.replace(/<br\s*\/?>/gi, '\n');
    const text = cheerio.load(textWithNewlines).text().trim();
    if (text) {
      authorText.push(text);
    }
  });

  // Split by newlines and process each author
  const allText = authorText.join('\n');

  // Normalize Unicode spaces before splitting
  const normalizedText = allText
    .replace(/[\u00A0\u2002\u2003]/g, ' ')  // Convert special spaces to regular
    .replace(/\u200B/g, '');  // Remove zero-width spaces

  // Split by multiple spaces (2 or more) which typically separate authors
  // Also try splitting by newlines first
  const rawAuthors = normalizedText
    .split(/\n+/)  // Split by newlines first
    .flatMap(line => line.split(/\s{2,}/))  // Then split by 2+ spaces
    .map(a => a.trim())
    .filter(Boolean);

  for (const author of rawAuthors) {
    // Remove superscript references like "1,2" or "1" from names
    // Pattern: numbers at the end like "Wu1,3" or "Huang1"
    const cleanName = author
      .replace(/\d+(?:,\s*\d+)*/g, '')  // Remove all number patterns like "1,3" or "2"
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    if (cleanName && !authors.includes(cleanName)) {
      authors.push(cleanName);
    }
  }

  // Fallback: try other author selectors
  if (authors.length === 0) {
    $('.ltx_author').each((_, el) => {
      const text = $(el).text().trim();
      const cleanName = text.replace(/\s*\d+(?:\s*,\s*\d+)*\s*$/g, '').trim();
      if (cleanName && !authors.includes(cleanName)) {
        authors.push(cleanName);
      }
    });
  }

  // Extract abstract
  let abstract = '';
  const abstractSection = $('.ltx_abstract').first();
  if (abstractSection.length) {
    // Remove the "Abstract." title if present
    abstractSection.find('.ltx_title.ltx_title_abstract').remove();
    abstract = abstractSection.text().trim().replace(/\s+/g, ' ');
  }

  // Extract subjects (from arXiv metadata)
  const subjects: string[] = [];
  $('.ltx_classification').each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      subjects.push(text);
    }
  });

  // Also try to get subjects from the text content
  const subjectMatch = $.text().match(/Subjects:\s*([^\n]+)/i);
  if (subjectMatch && subjects.length === 0) {
    const subjectList = subjectMatch[1].split(/;\s*/);
    subjects.push(...subjectList.map(s => s.trim()).filter(Boolean));
  }

  return {
    title,
    authors,
    abstract,
    subjects,
  };
}

/**
 * Sanitize a string to be safe for use as a filename.
 * Removes/replaces characters that are problematic in filesystems.
 */
export function sanitizeFilename(title: string): string {
  return title
    .replace(/[\\/*?"<>|:]/g, '')  // Remove illegal chars
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim()
    .substring(0, 100);             // Limit length
}
