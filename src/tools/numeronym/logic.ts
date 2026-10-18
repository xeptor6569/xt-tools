import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

/** "internationalization" → "i18n". Words shorter than `minLength` are kept as-is. */
export function numeronymWord(word: string, minLength = 4): string {
  const chars = [...word];
  if (chars.length < minLength) return word;
  return `${chars[0]}${chars.length - 2}${chars[chars.length - 1]}`;
}

/** Replaces every word in the text with its numeronym. */
export function numeronym(input: string, minLength = 4): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (!Number.isInteger(minLength) || minLength < 3 || minLength > 100) {
    throw new ToolInputError('The minimum length must be between 3 and 100.');
  }
  return input.replace(/[\p{L}\p{N}]+/gu, (w) => numeronymWord(w, minLength));
}
