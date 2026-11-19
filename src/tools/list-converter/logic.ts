import { ToolInputError } from '../types.ts';

export type Split = 'auto' | 'newline' | 'comma' | 'semicolon' | 'space' | 'tab' | 'pipe' | 'url';
type Delimiter = Exclude<Split, 'auto' | 'url'>;
export type Join = 'newline' | 'comma' | 'comma-space' | 'semicolon' | 'space' | 'tab' | 'pipe';
export type Sort = 'none' | 'asc' | 'desc' | 'natural' | 'length' | 'reverse' | 'shuffle';
export type Case = 'keep' | 'lower' | 'upper';

export interface ListOptions {
  split?: Split;
  join?: Join;
  trim?: boolean;
  removeEmpty?: boolean;
  dedupe?: boolean;
  sort?: Sort;
  caseMode?: Case;
  prefix?: string;
  suffix?: string;
  /** Text before and after the whole list, e.g. "[" and "]". */
  open?: string;
  close?: string;
  /** Keep at most this many characters of each item. Unset means no limit. */
  truncate?: number;
  /** Turn columns into rows. A line is a row; columns use the split delimiter. */
  transpose?: boolean;
  /** Needed for "shuffle": returns n random bytes. */
  random?: (n: number) => Uint8Array;
}

const MAX_INPUT = 5_000_000;
const URL_START = /https?:\/\//gi;
const SPLIT: Record<Delimiter, RegExp> = {
  newline: /\r?\n/,
  comma: /,/,
  semicolon: /;/,
  space: /\s+/,
  tab: /\t/,
  pipe: /\|/,
};
const JOIN: Record<Join, string> = {
  newline: '\n',
  comma: ',',
  'comma-space': ', ',
  semicolon: ';',
  space: ' ',
  tab: '\t',
  pipe: '|',
};
const COLUMN_JOIN: Record<Delimiter, string> = {
  newline: '\n',
  comma: ',',
  semicolon: ';',
  space: ' ',
  tab: '\t',
  pipe: '|',
};
const MAX_TRUNCATE = 100_000;

export function detectSplit(text: string): Delimiter {
  if (/\r?\n/.test(text.trim())) return 'newline';
  if (text.includes('\t')) return 'tab';
  if (text.includes(';') && !text.includes(',')) return 'semicolon';
  if (text.includes(',')) return 'comma';
  if (text.includes('|')) return 'pipe';
  return 'space';
}

/**
 * Splits where a new http or https link starts, including when the separator
 * between links was deleted. A link whose query contains another link is split
 * there too: the next scheme is the only signal that remains.
 */
export function splitOnUrls(text: string): string[] {
  const parts = text.split(/(?=https?:\/\/)/i).filter((part) => part !== '');
  return parts.length > 0 ? parts : [text];
}

function schemeCount(text: string): number {
  return text.match(URL_START)?.length ?? 0;
}

function shuffle<T>(items: T[], random: (n: number) => Uint8Array): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    // Rejection sampling keeps the shuffle unbiased.
    const limit = Math.floor(0x1_0000_0000 / (i + 1)) * (i + 1);
    let r: number;
    do {
      const b = random(4);
      r = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
    } while (r >= limit);
    const j = r % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Blank means no limit. Otherwise a whole number of characters, at most 100000. */
export function parseTruncate(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Truncate length must be a whole number, or left blank.');
  return checkTruncate(Number(trimmed));
}

function checkTruncate(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > MAX_TRUNCATE) {
    throw new ToolInputError(`Truncate length must be a whole number from 0 to ${MAX_TRUNCATE}.`);
  }
  return n;
}

/** Cuts `value` to `max` Unicode characters. A character is one code point. */
function truncateChars(value: string, max: number): string {
  if (max === 0) return '';
  let count = 0;
  for (let i = 0; i < value.length;) {
    if (count === max) return value.slice(0, i);
    const cp = value.codePointAt(i) ?? 0;
    i += cp > 0xffff ? 2 : 1;
    count += 1;
  }
  return value;
}

/** Column separator for a transpose. An explicit delimiter wins; otherwise the text is scanned. */
function columnDelimiter(input: string, split: Split): Delimiter {
  if (split === 'comma' || split === 'semicolon' || split === 'tab' || split === 'space' || split === 'pipe') {
    return split;
  }
  if (input.includes('\t')) return 'tab';
  if (input.includes(',')) return 'comma';
  if (input.includes(';')) return 'semicolon';
  if (input.includes('|')) return 'pipe';
  return 'comma';
}

function joinCells(cells: string[], joiner: string): string {
  let end = cells.length;
  while (end > 0 && cells[end - 1] === '') end -= 1;
  if (end === 0) return '';
  return cells.slice(0, end).join(joiner);
}

/** Each input line is a row. The result is one item per column. */
function transposeItems(input: string, delim: Delimiter, trim: boolean): string[] {
  const grid = input.split(/\r?\n/).map((line) => {
    const cells = line.split(SPLIT[delim]);
    return trim ? cells.map((cell) => cell.trim()) : cells;
  });
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const joiner = COLUMN_JOIN[delim];
  const columns: string[] = [];
  for (let col = 0; col < width; col++) {
    columns.push(
      joinCells(
        grid.map((row) => row[col] ?? ''),
        joiner,
      ),
    );
  }
  return columns;
}

export function listConverter(input: string, o: ListOptions = {}): { text: string; count: number } {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 5 MB).');
  if (input === '') return { text: '', count: 0 };
  const truncate = o.truncate === undefined ? undefined : checkTruncate(o.truncate);
  const trim = o.trim ?? true;
  let items: string[];
  if (o.transpose) {
    items = transposeItems(input, columnDelimiter(input, o.split ?? 'auto'), trim);
  } else {
    const split = o.split && o.split !== 'auto' ? o.split : detectSplit(input);
    items = split === 'url' ? splitOnUrls(input) : input.split(SPLIT[split]);
    // Detect also repairs a list whose separator was deleted, after the normal split.
    if (!o.split || o.split === 'auto') {
      items = items.flatMap((item) => (schemeCount(item) >= 2 ? splitOnUrls(item) : [item]));
    }
    if (trim) items = items.map((s) => s.trim());
  }
  if (o.removeEmpty ?? true) items = items.filter((s) => s !== '');
  if (o.caseMode === 'lower') items = items.map((s) => s.toLocaleLowerCase());
  if (o.caseMode === 'upper') items = items.map((s) => s.toLocaleUpperCase());
  if (o.dedupe) items = [...new Set(items)];
  const collator = new Intl.Collator(undefined, { numeric: o.sort === 'natural', sensitivity: 'base' });
  switch (o.sort) {
    case 'asc':
    case 'natural':
      items.sort(collator.compare);
      break;
    case 'desc':
      items.sort((a, b) => collator.compare(b, a));
      break;
    case 'length':
      items.sort((a, b) => a.length - b.length || collator.compare(a, b));
      break;
    case 'reverse':
      items.reverse();
      break;
    case 'shuffle':
      if (!o.random) throw new ToolInputError('Shuffling needs a source of randomness.');
      items = shuffle(items, o.random);
      break;
    default:
      break;
  }
  if (truncate !== undefined) items = items.map((s) => truncateChars(s, truncate));
  const body = items.map((s) => `${o.prefix ?? ''}${s}${o.suffix ?? ''}`).join(JOIN[o.join ?? 'newline']);
  return { text: `${o.open ?? ''}${body}${o.close ?? ''}`, count: items.length };
}
