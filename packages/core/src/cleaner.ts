import * as cheerio from 'cheerio';

const EVENT_HANDLERS = [
  'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
  'onmousemove', 'onmouseout', 'onmouseenter', 'onmouseleave',
  'onkeydown', 'onkeypress', 'onkeyup',
  'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset',
  'onload', 'onunload', 'onerror', 'onabort',
  'ondrag', 'ondragstart', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondrop',
  'onscroll', 'onresize',
  'onselect', 'oncopy', 'oncut', 'onpaste',
  'oncontextmenu', 'onwheel',
  'ontouchstart', 'ontouchmove', 'ontouchend', 'ontouchcancel',
  'onanimationstart', 'onanimationend', 'onanimationiteration',
  'ontransitionend',
];

export function removeTransformStyles(html: string): string {
  const $ = cheerio.load(html);

  $('.ltx_transformed_inner, .ltx_transformed_outer').each((_, element) => {
    const el = $(element);
    el.removeAttr('style');
  });

  $('*').each((_, element) => {
    const el = $(element);
    const attribs = 'attribs' in element ? (element as { attribs: Record<string, string> }).attribs : undefined;

    if (attribs && attribs['style']) {
      const style = attribs['style'];
      if (style.includes('transform:') || style.includes('translate(')) {
        el.removeAttr('style');
      }
    }
  });

  return $.html();
}

export function normalizeWhitespace(html: string): string {
  // Convert non-breaking spaces (U+00A0) to regular spaces
  return html.replace(/\u00A0/g, ' ');
}

export function sanitizeScripts(html: string): string {
  const $ = cheerio.load(html);

  $('script').remove();
  $('style').remove();
  $('base').remove();
  $('.ltx_note.ltx_note_front').remove();
  $('.ltx_bibliography').remove();

  $('.ltx_tag.ltx_tag_item, .ltx_tag.ltx_tag_bullet').remove();

  $('.ltx_item').each((_, element) => {
    const el = $(element);
    const style = el.attr('style');
    if (style && style.includes('list-style-type:none')) {
      el.removeAttr('style');
    }
    el.find('.ltx_para').each((_, para) => {
      const $para = $(para);
      $para.replaceWith($para.contents());
    });
  });

  $('*').each((_, element) => {
    const el = $(element);
    const attribs = 'attribs' in element ? (element as { attribs: Record<string, string> }).attribs : undefined;

    if (attribs) {
      for (const attr of EVENT_HANDLERS) {
        if (attribs[attr]) {
          el.removeAttr(attr);
        }
      }

      const href = attribs['href'];
      if (href && href.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttr('href');
      }
    }
  });

  return $.html();
}
