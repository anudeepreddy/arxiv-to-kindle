import * as cheerio from 'cheerio';
import path from 'path';

export interface ImageMapping {
  url: string;
  localPath: string;
}

function convertArxivLinksToAnchors(html: string, paperId: string): string {
  const $ = cheerio.load(html, { xml: true });
  
  const arxivPattern = /^https?:\/\/(?:www\.)?arxiv\.org\/html\/([^\/]+)\/?(?:#.*)?$/;
  const arxivPatternWithHash = /^https?:\/\/(?:www\.)?arxiv\.org\/html\/([^\/]+)(\/v\d+)?#(.+)$/;
  
  $('a[href]').each((_, element) => {
    const el = $(element);
    const href = el.attr('href');
    
    if (!href) return;
    
    const matchWithHash = href.match(arxivPatternWithHash);
    if (matchWithHash) {
      const anchorId = matchWithHash[3];
      el.attr('href', `#${anchorId}`);
      return;
    }
    
    if (arxivPattern.test(href)) {
      el.attr('href', '#');
    }
  });
  
  return $.html();
}

export function prepareForPandoc(
  html: string,
  imageMapping: ImageMapping[],
  paperId?: string
): string {
  const $ = cheerio.load(html, {
    xml: true,
  });

  const urlToFilename = new Map<string, string>();
  for (const mapping of imageMapping) {
    const filename = path.basename(mapping.localPath);
    urlToFilename.set(mapping.url, `./images/${filename}`);
  }

  $('img').each((_, element) => {
    const el = $(element);
    const src = el.attr('src');
    if (src && urlToFilename.has(src)) {
      el.attr('src', urlToFilename.get(src)!);
    }
  });

  $('math').each((_, element) => {
    const el = $(element);
    const parent = el.parent();
    if (parent.length > 0) {
      const parentTag = parent.get(0)?.tagName?.toLowerCase();
      if (parentTag !== 'div' || !parent.hasClass('ltx_math')) {
        const isOnlyChild = parent.children().length === 1;
        if (isOnlyChild && parentTag !== 'div') {
          el.wrap('<div class="ltx_math"></div>');
        }
      }
    }
  });

  let result = $.html();
  
  if (paperId) {
    result = convertArxivLinksToAnchors(result, paperId);
  }

  if (!result.toLowerCase().includes('<!doctype')) {
    result = '<!DOCTYPE html>\n' + result;
  }

  return result;
}
