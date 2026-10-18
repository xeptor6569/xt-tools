import { ToolInputError } from '../types.ts';

export type Split = 'auto' | 'newline' | 'comma' | 'semicolon' | 'space' | 'tab' | 'pipe';
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
  /** Needed for "shuffle": returns n random bytes. */
  random?: (n: number) => Uint8Array;
}

const MAX_INPUT = 5_000_000;
const SPLIT: Record<Exclude<Split, 'auto'>, RegExp> = {
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

export function detectSplit(text: string): Exclude<Split, 'auto'> {
  if (/\r?\n/.test(text.trim())) return 'newline';
  if (text.includes('\t')) return 'tab';
  if (text.includes(';') && !text.includes(',')) return 'semicolon';
  if (text.includes(',')) return 'comma';
  if (text.includes('|')) return 'pipe';
  return 'space';
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

export function listConverter(input: string, o: ListOptions = {}): { text: string; count: number } {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 5 MB).');
  if (input === '') return { text: '', count: 0 };
  const split = o.split && o.split !== 'auto' ? o.split : detectSplit(input);
  let items = input.split(SPLIT[split]);
  if (o.trim ?? true) items = items.map((s) => s.trim());
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
  const body = items.map((s) => `${o.prefix ?? ''}${s}${o.suffix ?? ''}`).join(JOIN[o.join ?? 'newline']);
  return { text: `${o.open ?? ''}${body}${o.close ?? ''}`, count: items.length };
}
