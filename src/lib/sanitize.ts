// HTML sanitizing for untrusted content (browser only). Removes scripts,
// event handlers, styles and forms, and any media that would be loaded from
// a URL (only inline data: and blob: images are kept), so previews never
// make network requests or log CSP errors.
import DOMPurify from 'dompurify';

let configured = false;
const INLINE = /^\s*(?:data|blob):/i;

function configure(): void {
  if (configured) return;
  configured = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as Element;
    for (const attr of ['src', 'srcset', 'poster', 'background', 'xlink:href']) {
      const value = el.getAttribute?.(attr);
      // srcset can mix several URLs, so it is always removed.
      if (value && (attr === 'srcset' || !INLINE.test(value))) {
        el.removeAttribute(attr);
        el.setAttribute('data-xt-blocked', 'external content blocked');
        if (el.tagName === 'IMG' && !el.getAttribute('alt')) el.setAttribute('alt', '[external image blocked]');
      }
    }
    if (el.tagName === 'A') {
      el.setAttribute('rel', 'noopener noreferrer');
      el.removeAttribute('target');
    }
  });
}

/**
 * Drops inline event handlers before the HTML is parsed at all. DOMPurify
 * removes them too, but Chrome reports a CSP violation as soon as a parsed
 * element carries one, even in an inert document.
 */
function stripHandlers(html: string): string {
  return html.replace(/<[a-z][^>]*>/gi, (tag) => tag.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, ''));
}

export function sanitizeHtml(html: string): string {
  configure();
  return DOMPurify.sanitize(stripHandlers(html), {
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: ['style', 'form', 'link', 'meta', 'base'],
    FORBID_ATTR: ['style'],
  });
}
