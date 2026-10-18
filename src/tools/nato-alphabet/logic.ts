import { ToolInputError } from '../types.ts';

export type Direction = 'auto' | 'encode' | 'decode';

const MAX_INPUT = 100_000;

// ICAO/NATO spelling alphabet. Digits use the standard English names.
const LETTERS = [
  'Alfa',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliett',
  'Kilo',
  'Lima',
  'Mike',
  'November',
  'Oscar',
  'Papa',
  'Quebec',
  'Romeo',
  'Sierra',
  'Tango',
  'Uniform',
  'Victor',
  'Whiskey',
  'X-ray',
  'Yankee',
  'Zulu',
];
const DIGITS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

const DECODE = new Map<string, string>([
  ...LETTERS.map((w, i): [string, string] => [w.toLowerCase(), String.fromCharCode(65 + i)]),
  ...DIGITS.map((w, i): [string, string] => [w.toLowerCase(), String(i)]),
  // Common alternative spellings and ICAO digit pronunciations.
  ['alpha', 'A'],
  ['juliet', 'J'],
  ['xray', 'X'],
  ['whisky', 'W'],
  ['tree', '3'],
  ['fower', '4'],
  ['fife', '5'],
  ['niner', '9'],
]);

export function encode(text: string): string {
  return text
    .split(/(\s+)/)
    .filter((w) => w !== '')
    .map((word) => {
      if (/^\s+$/.test(word)) return '/';
      return [...word]
        .map((ch) => {
          const upper = ch.toUpperCase();
          if (upper >= 'A' && upper <= 'Z') return LETTERS[upper.charCodeAt(0) - 65];
          if (ch >= '0' && ch <= '9') return DIGITS[Number(ch)];
          return ch;
        })
        .join(' ');
    })
    .join(' ');
}

export function decode(text: string): string {
  return text
    .trim()
    .split(/\s*\/\s*|\n/)
    .map((word) =>
      word
        .split(/\s+/)
        .filter(Boolean)
        .map(
          (token) =>
            DECODE.get(token.toLowerCase().replace(/[.,;:!?]$/, '')) ?? (token.length === 1 ? token : `[${token}]`),
        )
        .join(''),
    )
    .join(' ');
}

/** Guesses the direction: text made mostly of code words is decoded. */
export function looksEncoded(text: string): boolean {
  const tokens = text.split(/[\s/]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const known = tokens.filter((t) => DECODE.has(t.toLowerCase().replace(/[.,;:!?]$/, ''))).length;
  return known / tokens.length >= 0.8;
}

export function natoAlphabet(input: string, direction: Direction = 'auto'): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return '';
  const dir = direction === 'auto' ? (looksEncoded(input) ? 'decode' : 'encode') : direction;
  return dir === 'decode' ? decode(input) : encode(input.trim());
}
