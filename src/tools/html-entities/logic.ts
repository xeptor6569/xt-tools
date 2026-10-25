import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

const MAX_INPUT = 1_000_000;

/** Named characters this tool escapes and decodes. Numeric entities cover the rest. */
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  laquo: '\u00AB',
  raquo: '\u00BB',
  bull: '\u2022',
  middot: '\u00B7',
  euro: '\u20AC',
  pound: '\u00A3',
  yen: '\u00A5',
  cent: '\u00A2',
  sect: '\u00A7',
  para: '\u00B6',
  deg: '\u00B0',
  plusmn: '\u00B1',
  times: '\u00D7',
  divide: '\u00F7',
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function fromCodePoint(body: string): string {
  const hex = body[1] === 'x' || body[1] === 'X';
  const cp = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '\uFFFD';
  return String.fromCodePoint(cp);
}

function unescapeHtml(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, (all, body: string) => {
    if (body.startsWith('#')) return fromCodePoint(body);
    return NAMED[body.toLowerCase()] ?? all;
  });
}

/** Escape the five HTML specials, and decode named plus numeric character references. */
export function htmlEntities(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  return [
    { label: 'Escaped', value: escapeHtml(input) },
    { label: 'Unescaped', value: unescapeHtml(input) },
  ];
}
