import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

const MAX_INPUT = 10_000_000;
const n = (x: number) => x.toLocaleString('en-US');

/** Reading at 238 words per minute and speaking at 140 (common averages). */
function minutes(words: number, perMinute: number): string {
  const total = Math.round((words / perMinute) * 60);
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function textStats(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 10 MB).');
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' });
  let graphemes = 0;
  for (const _ of segmenter.segment(input)) graphemes++;
  let words = 0;
  for (const s of wordSegmenter.segment(input)) if (s.isWordLike) words++;
  const sentences =
    input.trim() === ''
      ? 0
      : (input.match(/[^.!?…。！？]+(?:[.!?…。！？]+|$)/g) ?? []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
  const lines = input === '' ? 0 : input.split(/\r\n|\r|\n/).length;
  const paragraphs = input.split(/\n\s*\n/).filter((p) => p.trim() !== '').length;
  const bytes = new TextEncoder().encode(input).length;

  return [
    { label: 'Characters', value: n(graphemes) },
    { label: 'Characters (no spaces)', value: n([...segmenter.segment(input.replace(/\s+/g, ''))].length) },
    { label: 'Words', value: n(words) },
    { label: 'Sentences', value: n(sentences) },
    { label: 'Paragraphs', value: n(paragraphs) },
    { label: 'Lines', value: n(lines) },
    { label: 'Bytes (UTF-8)', value: n(bytes) },
    { label: 'UTF-16 code units (JS length)', value: n(input.length) },
    { label: 'Reading time', value: minutes(words, 238) },
    { label: 'Speaking time', value: minutes(words, 140) },
  ];
}
