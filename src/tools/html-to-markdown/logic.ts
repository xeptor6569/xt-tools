import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { ToolInputError } from '../types.ts';

export type HeadingStyle = 'atx' | 'setext';
export type BulletMarker = '-' | '*' | '+';

export interface HtmlToMarkdownOptions {
  headingStyle?: HeadingStyle;
  bulletListMarker?: BulletMarker;
  codeBlockStyle?: 'fenced' | 'indented';
  gfm?: boolean;
}

const MAX_INPUT = 5_000_000;

/**
 * Converts HTML to Markdown. The HTML is parsed into an inert document
 * (nothing is loaded or run); scripts, styles and forms are dropped.
 */
export function htmlToMarkdown(input: string, options: HtmlToMarkdownOptions = {}): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 5 MB).');
  if (input.trim() === '') return '';
  const service = new TurndownService({
    headingStyle: options.headingStyle ?? 'atx',
    bulletListMarker: options.bulletListMarker ?? '-',
    codeBlockStyle: options.codeBlockStyle ?? 'fenced',
    emDelimiter: '_',
    hr: '---',
  });
  if (options.gfm ?? true) service.use(gfm);
  service.remove([
    'script',
    'style',
    'noscript',
    'template',
    'iframe',
    'object',
    'embed',
    'form',
    'head',
    'meta',
    'link',
  ]);
  try {
    return service.turndown(input).trim();
  } catch (error) {
    throw new ToolInputError(`Couldn't convert this HTML: ${(error as Error).message}`);
  }
}
