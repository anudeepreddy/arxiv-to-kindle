import * as cheerio from 'cheerio';

export function resolveImageUrls(html: string, baseUrl: string): {
  cleanedHtml: string;
  imageUrls: string[];
} {
  const $ = cheerio.load(html);
  const imageUrls: Set<string> = new Set();

  $('img').each((_, element) => {
    const el = $(element);
    const src = el.attr('src');

    if (!src) {
      return;
    }

    if (src.startsWith('data:')) {
      return;
    }

    let absoluteUrl: string;

    if (src.startsWith('http://') || src.startsWith('https://')) {
      absoluteUrl = src;
    } else {
      absoluteUrl = new URL(src, baseUrl).href;
    }

    el.attr('src', absoluteUrl);
    imageUrls.add(absoluteUrl);
  });

  return {
    cleanedHtml: $.html(),
    imageUrls: Array.from(imageUrls),
  };
}
