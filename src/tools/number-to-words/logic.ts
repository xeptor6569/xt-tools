import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// Short scale (US and modern British usage).
const SCALES = [
  '',
  'thousand',
  'million',
  'billion',
  'trillion',
  'quadrillion',
  'quintillion',
  'sextillion',
  'septillion',
  'octillion',
  'nonillion',
  'decillion',
  'undecillion',
  'duodecillion',
  'tredecillion',
  'quattuordecillion',
  'quindecillion',
  'sexdecillion',
  'septendecillion',
  'octodecillion',
  'novemdecillion',
  'vigintillion',
];
const MAX_DIGITS = SCALES.length * 3;

function under1000(n: number, british: boolean): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) {
    if (hundreds && british) parts.push('and');
    parts.push(rest < 20 ? ONES[rest]! : TENS[Math.floor(rest / 10)]! + (rest % 10 ? `-${ONES[rest % 10]}` : ''));
  }
  return parts.join(' ');
}

/** Spells a non-negative integer (given as a digit string) in English. */
export function integerWords(digits: string, british = false): string {
  const clean = digits.replace(/^0+(?=\d)/, '');
  if (clean === '0') return 'zero';
  const groups: number[] = [];
  for (let i = clean.length; i > 0; i -= 3) groups.unshift(Number(clean.slice(Math.max(0, i - 3), i)));
  const words: string[] = [];
  groups.forEach((g, i) => {
    if (g === 0) return;
    const scale = SCALES[groups.length - 1 - i];
    const isLast = i === groups.length - 1;
    // British: "one thousand and five".
    if (british && isLast && g < 100 && words.length > 0) words.push('and');
    words.push(under1000(g, british) + (scale ? ` ${scale}` : ''));
  });
  return words.join(' ');
}

const ORDINAL: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};

export function ordinalWords(cardinal: string): string {
  return cardinal.replace(/(\w+)$/, (word) => {
    if (ORDINAL[word]) return ORDINAL[word];
    if (word.endsWith('y')) return `${word.slice(0, -1)}ieth`;
    return `${word}th`;
  });
}

export function ordinalSuffix(digits: string): string {
  const n = Number(digits.slice(-2));
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${suffix}`;
}

export function numberToWords(input: string, { british = false } = {}): Variant[] {
  const s = input.trim().replace(/[,_\s]/g, '');
  if (s === '') return [];
  const m = /^([-+])?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new ToolInputError('Enter a number such as 1234, -56 or 78.90.');
  const [, sign, whole = '0', fraction] = m;
  if (whole.replace(/^0+/, '').length > MAX_DIGITS)
    throw new ToolInputError(`Numbers up to ${MAX_DIGITS} digits are supported.`);
  if ((fraction?.length ?? 0) > 20) throw new ToolInputError('Up to 20 decimal places are supported.');

  const minus = sign === '-' && /[1-9]/.test(whole + (fraction ?? '')) ? 'minus ' : '';
  const cardinal = integerWords(whole, british);
  const decimals = fraction ? ` point ${[...fraction].map((d) => ONES[Number(d)]).join(' ')}` : '';
  const out: Variant[] = [{ label: 'Words', value: minus + cardinal + decimals }];

  if (!fraction && !minus) {
    out.push(
      { label: 'Ordinal', value: ordinalWords(cardinal) },
      { label: 'Ordinal (digits)', value: ordinalSuffix(whole.replace(/^0+(?=\d)/, '')) },
    );
  }
  if (!minus && (!fraction || fraction.length <= 2)) {
    const cents = (fraction ?? '').padEnd(2, '0');
    const words = cardinal.charAt(0).toUpperCase() + cardinal.slice(1);
    out.push({ label: 'Cheque style', value: `${words} and ${cents}/100` });
  }
  return out;
}
