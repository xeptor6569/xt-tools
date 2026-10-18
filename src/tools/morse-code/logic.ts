import { ToolInputError } from '../types.ts';

export type Direction = 'auto' | 'encode' | 'decode';

const MAX_INPUT = 100_000;

// ITU-R M.1677-1 International Morse code, plus common punctuation.
const CODE: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.',
};
const DECODE = new Map(Object.entries(CODE).map(([k, v]) => [v, k]));

export function encode(text: string): { morse: string; skipped: string[] } {
  const skipped = new Set<string>();
  const words = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .map((w) =>
      [...w]
        .map((ch) => {
          const code = CODE[ch];
          if (!code) skipped.add(ch);
          return code;
        })
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean);
  return { morse: words.join(' / '), skipped: [...skipped] };
}

export function decode(morse: string): string {
  return morse
    .trim()
    .replace(/[·•]/g, '.')
    .replace(/[−–—_]/g, '-')
    .split(/\s*[/|]\s*|\s{3,}|\n/)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => {
          if (!/^[.-]+$/.test(code)) throw new ToolInputError(`"${code.slice(0, 20)}" isn't Morse code (use . and -).`);
          return DECODE.get(code) ?? '�';
        })
        .join(''),
    )
    .join(' ');
}

export function morseCode(input: string, direction: Direction = 'auto'): { text: string; skipped: string[] } {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return { text: '', skipped: [] };
  const dir = direction === 'auto' ? (/^[\s.\-/|·•−–—_]+$/.test(input) ? 'decode' : 'encode') : direction;
  if (dir === 'decode') return { text: decode(input), skipped: [] };
  const { morse, skipped } = encode(input);
  return { text: morse, skipped };
}

/** On/off durations, in dot units, for playing Morse as sound. */
export function timings(morse: string): Array<{ on: boolean; units: number }> {
  const out: Array<{ on: boolean; units: number }> = [];
  const gap = (units: number) => {
    const last = out[out.length - 1];
    if (!last) return;
    if (!last.on) last.units = Math.max(last.units, units);
    else out.push({ on: false, units });
  };
  for (const word of morse.trim().split(/\s*\/\s*/)) {
    gap(7);
    for (const letter of word.split(/\s+/)) {
      gap(3);
      [...letter].forEach((symbol, i) => {
        if (i > 0) gap(1);
        if (symbol === '.' || symbol === '-') out.push({ on: true, units: symbol === '.' ? 1 : 3 });
      });
    }
  }
  return out;
}
