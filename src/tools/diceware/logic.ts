import { ToolInputError } from '../types.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export const MIN_WORDS = 4;
export const MAX_WORDS = 10;
export const DEFAULT_WORDS = 6;

/** Parses the word-count field. Blank means 6. */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return DEFAULT_WORDS;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < MIN_WORDS || n > MAX_WORDS) throw new ToolInputError(`Enter a word count from ${MIN_WORDS} to ${MAX_WORDS}.`);
  return n;
}

function draw(random: RandomBytes, size: number): number {
  if (size < 2 || size > 65535) throw new ToolInputError('Word list length is not supported.');
  const limit = Math.floor(65536 / size) * size;
  for (let attempt = 0; attempt < 64; attempt++) {
    const bytes = random(2);
    if (bytes.length !== 2) throw new ToolInputError('Random source returned the wrong number of bytes.');
    const n = (bytes[0]! << 8) | bytes[1]!;
    if (n < limit) return n % size;
  }
  throw new ToolInputError('Could not draw an unbiased word. Try again.');
}

/**
 * One Diceware passphrase of `count` words. `words` is the EFF large list (or a test list).
 * Indexing uses rejection sampling so every word is equally likely.
 */
export function diceware(count: number, random: RandomBytes, words: readonly string[]): string[] {
  if (!Number.isInteger(count) || count < MIN_WORDS || count > MAX_WORDS) {
    throw new ToolInputError(`Enter a word count from ${MIN_WORDS} to ${MAX_WORDS}.`);
  }
  if (words.length < 2) throw new ToolInputError('Word list is empty.');
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const word = words[draw(random, words.length)];
    if (!word) throw new ToolInputError('Word list is missing an entry.');
    picked.push(word);
  }
  return [picked.join(' ')];
}
