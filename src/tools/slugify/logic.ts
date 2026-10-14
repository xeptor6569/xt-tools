import { ToolInputError } from '../types.ts';

export type Separator = '-' | '_' | '.';

export interface SlugifyOptions {
  separator?: Separator;
  lowercase?: boolean;
}

const MAX_INPUT = 1_000_000;

// Letters that Unicode normalization does not decompose into ASCII.
const SPECIAL: Record<string, string> = {
  ß: 'ss',
  ẞ: 'SS',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ø: 'o',
  Ø: 'O',
  đ: 'd',
  Đ: 'D',
  ł: 'l',
  Ł: 'L',
  þ: 'th',
  Þ: 'TH',
  ð: 'd',
  Ð: 'D',
  ı: 'i',
};

/**
 * Turns text into an ASCII slug: accents are removed, `&` becomes "and",
 * apostrophes are dropped and every other run of non-alphanumeric characters
 * becomes a single separator.
 */
export function slugify(input: string, options: SlugifyOptions = {}): string {
  const { separator = '-', lowercase = true } = options;
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';

  let text = input
    .replace(/[ßẞæÆœŒøØđĐłŁþÞðÐı]/g, (ch) => SPECIAL[ch] ?? ch)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/&/g, ' and ')
    .replace(/['’‘`]/g, '');

  if (lowercase) text = text.toLowerCase();

  const slug = text
    .replace(/[^A-Za-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '');

  if (slug === '') {
    throw new ToolInputError('There are no Latin letters or digits in this text to build a slug from.');
  }
  return slug;
}
