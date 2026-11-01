import { Marked } from 'marked';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 5_000_000;

const marked = new Marked({ gfm: true, breaks: false, async: false });

export interface MarkdownStats {
  words: number;
  headings: number;
  links: number;
}

/**
 * Renders Markdown (GitHub-flavoured) to HTML. The result is NOT sanitized:
 * show it only through SandboxedPreview, which sanitizes and sandboxes it.
 */
export function markdownToHtml(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 5 MB).');
  try {
    return marked.parse(input) as string;
  } catch (error) {
    throw new ToolInputError(`Couldn't render this Markdown: ${(error as Error).message}`);
  }
}

export function markdownStats(input: string): MarkdownStats {
  return {
    words: (input.match(/[\p{L}\p{N}]+/gu) ?? []).length,
    headings: (input.match(/^#{1,6}\s/gm) ?? []).length,
    links: (input.match(/\[[^\]]*\]\([^)]*\)/g) ?? []).length,
  };
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;

/**
 * Conservative Markdown tidy-up that leaves the rendered result the same:
 * normalises line endings, drops invisible characters and non-breaking spaces,
 * strips trailing whitespace (keeping two-space hard breaks), collapses runs of
 * blank lines, puts blank lines around headings and ends with one newline.
 * Fenced code is left untouched (indented code blocks and fences nested in lists
 * are not detected). Running it twice gives the same result.
 */
export function cleanMarkdown(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 5 MB).');
  const lines = input
    .replace(/\r\n?/g, '\n')
    .replace(/^\uFEFF/, '')
    .split('\n');
  const out: string[] = [];
  let fence: { char: string; length: number } | null = null;

  const pushBlank = () => {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const marker = FENCE.exec(raw);

    if (fence) {
      out.push(raw);
      const fenceChar = marker?.[1]?.[0];
      if (marker && fenceChar === fence.char && (marker[1]?.length ?? 0) >= fence.length && !marker[2]?.trim()) {
        fence = null;
      }
      continue;
    }

    let line = raw.replace(/[\u200B\u2060\uFEFF]/g, '').replace(/\u00A0/g, ' ');
    const next = lines[i + 1];
    const hardBreak = / {2,}$/.test(line) && !ATX_HEADING.test(line) && next !== undefined && next.trim() !== '';
    line = line.replace(/[ \t]+$/, '');
    if (hardBreak) line += '  ';

    if (marker && marker[1] && !(marker[1][0] === '`' && marker[2]?.includes('`'))) {
      fence = { char: marker[1][0] as string, length: marker[1].length };
      out.push(line);
      continue;
    }

    if (line === '') {
      pushBlank();
      continue;
    }

    if (ATX_HEADING.test(line)) {
      pushBlank();
      out.push(line);
      if (next !== undefined && next.trim() !== '') out.push('');
      continue;
    }

    out.push(line);
  }

  while (out[out.length - 1] === '') out.pop();
  return out.length > 0 ? `${out.join('\n')}\n` : '';
}

/**
 * Extra rules for paper and PDF output. They live outside PREVIEW_CSS (which is
 * hashed into the site CSP) and are only added to documents we generate.
 */
export const PRINT_CSS =
  '@page{margin:2cm}' +
  '@media print{' +
  'html{font-size:11pt}' +
  "body{padding:0;color:#000;background:#fff;font-family:Georgia,'Times New Roman',serif;line-height:1.5}" +
  'h1,h2,h3,h4,h5,h6{color:#000;break-after:avoid;page-break-after:avoid}' +
  'pre,blockquote,table,img,figure,tr{break-inside:avoid;page-break-inside:avoid}' +
  'pre{white-space:pre-wrap;overflow:visible;background:#fff;border:1px solid #999}' +
  'code{background:none}' +
  'thead{display:table-header-group}' +
  'th,td{border-color:#666}' +
  'blockquote{border-left-color:#666;color:#000}' +
  'a{color:#000;text-decoration:underline}' +
  'a[href^="http"]::after{content:" (" attr(href) ")";font-size:.85em;word-break:break-all}' +
  'input[type=checkbox]{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
  '}';

/**
 * A standalone HTML document for download or printing. `body` must already be
 * sanitized; the CSP forbids every script and any network request.
 */
export function htmlDocument(title: string, body: string, css: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:">
<title>${esc(title)}</title>
<style>${css.replace(/<\/style/gi, '')}</style>
</head>
<body>
${body}
</body>
</html>
`;
}
