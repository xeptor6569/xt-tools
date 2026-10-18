import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

const MAX_INPUT = 200_000;

const hex = (n: number, width = 4) => n.toString(16).toUpperCase().padStart(width, '0');
const isPlainAscii = (cp: number) => cp >= 0x20 && cp < 0x7f;

/** Like encodeURIComponent, but never throws on unpaired surrogates (they become U+FFFD). */
function percentEncode(input: string, all: boolean): string {
  return [...new TextEncoder().encode(input)]
    .map((b) =>
      !all && /[A-Za-z0-9\-_.!~*'()]/.test(String.fromCharCode(b)) ? String.fromCharCode(b) : `%${hex(b, 2)}`,
    )
    .join('');
}

/** Code points and escaped forms of `input`. With `all`, printable ASCII is escaped too. */
export function textToUnicode(input: string, { all = false } = {}): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 200,000 characters).');
  if (input === '') return [];
  const points = [...input].map((ch) => ch.codePointAt(0) ?? 0);
  const keep = (cp: number) => !all && isPlainAscii(cp);
  const units = (cp: number) => {
    const s = String.fromCodePoint(cp);
    return [...Array(s.length).keys()].map((i) => s.charCodeAt(i));
  };

  const map = (fn: (cp: number) => string) =>
    points.map((cp) => (keep(cp) ? String.fromCodePoint(cp) : fn(cp))).join('');

  return [
    { label: 'Code points', value: points.map((cp) => `U+${hex(cp)}`).join(' ') },
    { label: 'JavaScript (ES6)', value: map((cp) => `\\u{${hex(cp, 1)}}`) },
    {
      label: 'JSON / Java (UTF-16)',
      value: map((cp) =>
        units(cp)
          .map((u) => `\\u${hex(u)}`)
          .join(''),
      ),
    },
    { label: 'Python', value: map((cp) => (cp > 0xffff ? `\\U${hex(cp, 8)}` : `\\u${hex(cp)}`)) },
    { label: 'CSS', value: map((cp) => `\\${hex(cp, 6)}`) },
    { label: 'HTML (hex)', value: map((cp) => `&#x${hex(cp, 1)};`) },
    { label: 'HTML (decimal)', value: map((cp) => `&#${cp};`) },
    { label: 'URL (percent)', value: percentEncode(input, all) },
    { label: 'UTF-8 bytes', value: [...new TextEncoder().encode(input)].map((b) => hex(b, 2)).join(' ') },
    {
      label: 'UTF-16 code units',
      value: points
        .flatMap(units)
        .map((u) => hex(u))
        .join(' '),
    },
  ];
}
