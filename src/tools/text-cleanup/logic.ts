import { ToolInputError } from '../types.ts';

export interface CleanupOptions {
  trimLines?: boolean;
  collapseSpaces?: boolean;
  blankLines?: 'keep' | 'collapse' | 'remove';
  dedupe?: boolean;
  dedupeIgnoreCase?: boolean;
  tabsToSpaces?: number;
  stripInvisible?: boolean;
  smartQuotes?: boolean;
}

export interface CleanupResult {
  text: string;
  linesBefore: number;
  linesAfter: number;
}

const MAX_INPUT = 10_000_000;
// Zero-width and other invisible formatting characters (not ZWJ, which joins emoji).
const INVISIBLE = /[\u00ad\u180e\u200b\u200c\u200e\u200f\u2060-\u2064\u206a-\u206f\ufeff\u202a-\u202e\u2066-\u2069]/g;

export function textCleanup(input: string, o: CleanupOptions = {}): CleanupResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 10 MB).');
  if (input === '') return { text: '', linesBefore: 0, linesAfter: 0 };
  let text = input.replace(/\r\n?/g, '\n');
  if (o.stripInvisible) text = text.replace(INVISIBLE, '');
  if (o.smartQuotes)
    text = text
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...');
  if (o.tabsToSpaces) text = text.replace(/\t/g, ' '.repeat(o.tabsToSpaces));
  let lines = text.split('\n');
  const before = lines.length;
  if (o.trimLines ?? true) lines = lines.map((l) => l.trim());
  else lines = lines.map((l) => l.replace(/\s+$/, ''));
  if (o.collapseSpaces) lines = lines.map((l) => l.replace(/[ \t\u00a0]{2,}/g, ' '));
  if (o.dedupe) {
    const seen = new Set<string>();
    lines = lines.filter((l) => {
      if (l === '') return true;
      const key = o.dedupeIgnoreCase ? l.toLowerCase() : l;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const blank = o.blankLines ?? 'collapse';
  if (blank === 'remove') lines = lines.filter((l) => l.trim() !== '');
  else if (blank === 'collapse')
    lines = lines.filter((l, i) => l.trim() !== '' || (i > 0 && lines[i - 1]!.trim() !== ''));
  // Drop leading and trailing blank lines.
  while (lines.length && lines[0]!.trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
  return { text: lines.join('\n'), linesBefore: before, linesAfter: lines.length };
}
