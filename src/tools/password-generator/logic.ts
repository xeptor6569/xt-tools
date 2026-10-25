import { ToolInputError } from '../types.ts';
import { diceware, parseCount as parseWordCount, type RandomBytes } from '../diceware/logic.ts';

export type { RandomBytes };

export const LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS = '0123456789';
export const SYMBOLS = '!@#$%^&*-_=+?';

const AMBIGUOUS = new Set(['l', 'I', 'O', 'o', '0', '1']);

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  /** Drop 0, O, o, 1, l and I. */
  excludeAmbiguous: boolean;
}

export type Separator = 'space' | 'hyphen' | 'none';

export interface PassphraseOptions {
  words: number;
  separator: Separator;
  capitalize: boolean;
}

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;
export const DEFAULT_LENGTH = 20;
export const MAX_COUNT = 20;

function pool(chars: string, excludeAmbiguous: boolean): string {
  if (!excludeAmbiguous) return chars;
  return [...chars].filter((char) => !AMBIGUOUS.has(char)).join('');
}

/** The selected character sets, ambiguous characters removed when asked. */
export function alphabet(options: PasswordOptions): { all: string; groups: string[] } {
  const groups = [
    options.lower ? pool(LOWER, options.excludeAmbiguous) : '',
    options.upper ? pool(UPPER, options.excludeAmbiguous) : '',
    options.digits ? pool(DIGITS, options.excludeAmbiguous) : '',
    options.symbols ? pool(SYMBOLS, options.excludeAmbiguous) : '',
  ].filter((group) => group.length > 0);
  if (groups.length === 0) throw new ToolInputError('Choose at least one character set.');
  return { all: groups.join(''), groups };
}

/** Parses how many passwords or passphrases to make. Blank means one. */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > MAX_COUNT) throw new ToolInputError(`Enter a count from 1 to ${MAX_COUNT}.`);
  return n;
}

/** Parses the password length. Blank means 20. */
export function parseLength(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return DEFAULT_LENGTH;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number of characters.');
  const n = Number(trimmed);
  if (n < MIN_LENGTH || n > MAX_LENGTH) {
    throw new ToolInputError(`Enter a length from ${MIN_LENGTH} to ${MAX_LENGTH}.`);
  }
  return n;
}

export { parseWordCount };

function drawIndex(random: RandomBytes, size: number): number {
  if (size < 1) throw new ToolInputError('Character set is empty.');
  if (size === 1) return 0;
  const limit = Math.floor(256 / size) * size;
  for (let attempt = 0; attempt < 64; attempt++) {
    const bytes = random(1);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 1) {
      throw new ToolInputError('Random source returned the wrong number of bytes.');
    }
    const n = bytes[0]!;
    if (n < limit) return n % size;
  }
  throw new ToolInputError('Could not draw an unbiased character. Try again.');
}

function shuffle(chars: string[], random: RandomBytes): void {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = drawIndex(random, i + 1);
    const swap = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = swap;
  }
}

function onePassword(options: PasswordOptions, random: RandomBytes): string {
  const { all, groups } = alphabet(options);
  if (options.length < groups.length) {
    throw new ToolInputError('Length must be at least the number of selected character sets.');
  }
  const chars = groups.map((group) => group[drawIndex(random, group.length)]!);
  while (chars.length < options.length) chars.push(all[drawIndex(random, all.length)]!);
  shuffle(chars, random);
  return chars.join('');
}

/**
 * `count` passwords. Each one uses every selected character set at least once.
 * Randomness comes only from `random`.
 */
export function passwordGenerator(count: number, options: PasswordOptions, random: RandomBytes): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new ToolInputError(`Enter a count from 1 to ${MAX_COUNT}.`);
  }
  if (!Number.isInteger(options.length) || options.length < MIN_LENGTH || options.length > MAX_LENGTH) {
    throw new ToolInputError(`Enter a length from ${MIN_LENGTH} to ${MAX_LENGTH}.`);
  }
  return Array.from({ length: count }, () => onePassword(options, random));
}

/** Rough entropy of one password: length × log2(charset size). */
export function passwordBits(options: PasswordOptions): number {
  const { all } = alphabet(options);
  return Math.round(options.length * Math.log2(all.length) * 10) / 10;
}

function formatPhrase(phrase: string, options: PassphraseOptions): string {
  let parts = phrase.split(' ');
  if (options.capitalize) {
    parts = parts.map((word) => (word === '' ? word : word.charAt(0).toUpperCase() + word.slice(1)));
  }
  const separator = options.separator === 'hyphen' ? '-' : options.separator === 'none' ? '' : ' ';
  return parts.join(separator);
}

/**
 * `count` Diceware passphrases. `words` is the EFF large list, or a test list.
 * Indexing is the unbiased draw from the Diceware tool.
 */
export function passphraseGenerator(
  count: number,
  options: PassphraseOptions,
  words: readonly string[],
  random: RandomBytes,
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new ToolInputError(`Enter a count from 1 to ${MAX_COUNT}.`);
  }
  return Array.from({ length: count }, () => {
    const phrase = diceware(options.words, random, words)[0];
    if (!phrase) throw new ToolInputError('Word list is missing an entry.');
    return formatPhrase(phrase, options);
  });
}
