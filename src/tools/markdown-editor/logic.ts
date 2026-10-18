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
