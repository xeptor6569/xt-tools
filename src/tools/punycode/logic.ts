import { ToolInputError } from '../types.ts';
import { decode, encode } from './punycode.ts';

const MAX_INPUT = 100_000;
const MAX_LINES = 2000;

/** Converts one domain (or email address) to ASCII (xn--) or back to Unicode. */
export function convertDomain(text: string): string {
  const at = text.lastIndexOf('@');
  const [local, domain] = at >= 0 ? [text.slice(0, at + 1), text.slice(at + 1)] : ['', text];
  const labels = domain.split(/[.。．｡]/);
  const toUnicode = labels.some((l) => /^xn--/i.test(l));
  const converted = labels.map((label) => {
    if (toUnicode) return /^xn--/i.test(label) ? decode(label.slice(4).toLowerCase()) : label;
    if ([...label].every((c) => c.charCodeAt(0) < 0x80)) return label.toLowerCase();
    const ascii = `xn--${encode(label.normalize('NFC').toLowerCase())}`;
    if (ascii.length > 63)
      throw new ToolInputError(`"${label}" is too long for a domain label (63 characters encoded).`);
    return ascii;
  });
  return local + converted.join('.');
}

/** Each line is converted in whichever direction applies. */
export function punycode(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const lines = input.split('\n');
  if (lines.length > MAX_LINES) throw new ToolInputError(`Too many lines (maximum ${MAX_LINES}).`);
  return lines.map((l) => (l.trim() === '' ? '' : convertDomain(l.trim()))).join('\n');
}
