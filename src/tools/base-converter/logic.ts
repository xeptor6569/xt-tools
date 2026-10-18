import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

export type FromBase = 'auto' | number;

const MAX_INPUT = 10_000;
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const PREFIXES: Array<[RegExp, number]> = [
  [/^0x/i, 16],
  [/^0o/i, 8],
  [/^0b/i, 2],
];

/** Parses an integer of any size in base 2–36. "auto" reads 0x/0o/0b prefixes and defaults to decimal. */
export function parseInteger(text: string, from: FromBase = 'auto'): bigint {
  let s = text.trim().replace(/[\s_,']/g, '');
  let negative = false;
  if (s.startsWith('-') || s.startsWith('+')) {
    negative = s.startsWith('-');
    s = s.slice(1);
  }
  let base = from === 'auto' ? 10 : from;
  if (from === 'auto' || base === 16 || base === 8 || base === 2) {
    for (const [re, b] of PREFIXES) {
      if (re.test(s) && (from === 'auto' || from === b)) {
        base = b;
        s = s.slice(2);
      }
    }
  }
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new ToolInputError('The base must be between 2 and 36.');
  if (s === '') throw new ToolInputError('Enter a number.');
  let value = 0n;
  const big = BigInt(base);
  for (const ch of s.toLowerCase()) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) throw new ToolInputError(`"${ch}" isn't a valid digit in base ${base}.`);
    value = value * big + BigInt(d);
  }
  return negative ? -value : value;
}

function group(digits: string, size: number, sep: string): string {
  if (size <= 0) return digits;
  const out: string[] = [];
  for (let i = digits.length; i > 0; i -= size) out.unshift(digits.slice(Math.max(0, i - size), i));
  return out.join(sep);
}

export function baseConverter(
  input: string,
  { from = 'auto' as FromBase, custom = 36, grouped = false } = {},
): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('The number is too long.');
  if (input.trim() === '') return [];
  const n = parseInteger(input, from);
  const sign = n < 0n ? '-' : '';
  const abs = n < 0n ? -n : n;
  const show = (base: number, size: number, sep: string) =>
    sign + (grouped ? group(abs.toString(base), size, sep) : abs.toString(base));
  const bits = abs === 0n ? 1 : abs.toString(2).length;
  const out: Variant[] = [
    { label: 'Binary (base 2)', value: show(2, 4, ' ') },
    { label: 'Octal (base 8)', value: show(8, 3, ' ') },
    { label: 'Decimal (base 10)', value: show(10, 3, ',') },
    { label: 'Hexadecimal (base 16)', value: show(16, 4, ' ').toUpperCase() },
    { label: 'Base 32 (radix)', value: show(32, 4, ' ') },
    { label: 'Base 36', value: show(36, 4, ' ') },
  ];
  if (![2, 8, 10, 16, 32, 36].includes(custom)) {
    if (custom < 2 || custom > 36) throw new ToolInputError('The custom base must be between 2 and 36.');
    out.push({ label: `Base ${custom}`, value: show(custom, 4, ' ') });
  }
  out.push({ label: 'Bit length', value: String(bits) });
  return out;
}
