import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;
const MAX_LINES = 5000;

const TABLE: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

// Only the standard (subtractive) forms, 1–3999.
const VALID = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new ToolInputError(`${n} can't be written in standard Roman numerals (1 to 3999 only).`);
  }
  let out = '';
  for (const [value, symbol] of TABLE) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

export function fromRoman(text: string): number {
  const s = text.trim().toUpperCase();
  if (s === '' || !VALID.test(s)) throw new ToolInputError(`"${text.trim()}" isn't a valid Roman numeral.`);
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = TABLE.find(([, sym]) => sym === s[i])?.[0] ?? 0;
    const next = TABLE.find(([, sym]) => sym === s[i + 1])?.[0] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
}

/** Converts each line: numbers become Roman numerals and Roman numerals become numbers. */
export function romanNumerals(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const lines = input.split('\n');
  if (lines.length > MAX_LINES) throw new ToolInputError(`Too many lines (maximum ${MAX_LINES}).`);
  return lines
    .map((line) => {
      const s = line.trim();
      if (s === '') return '';
      if (/^\d+$/.test(s)) return toRoman(Number(s));
      if (/^[ivxlcdm]+$/i.test(s)) return String(fromRoman(s));
      throw new ToolInputError(`"${s.slice(0, 40)}" is neither a number nor a Roman numeral.`);
    })
    .join('\n');
}
