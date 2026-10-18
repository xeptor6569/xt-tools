import { ToolInputError } from '../types.ts';

export interface WordCount {
  word: string;
  count: number;
  share: string;
}

export interface FrequencyResult {
  rows: WordCount[];
  totalWords: number;
  uniqueWords: number;
}

const MAX_INPUT = 10_000_000;

// Common English function words.
export const STOP_WORDS = new Set(
  'a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves'.split(
    ' ',
  ),
);

export function wordFrequency(
  input: string,
  { ignoreCase = true, excludeStopWords = false, minLength = 1, limit = 500 } = {},
): FrequencyResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 10 MB).');
  const counts = new Map<string, number>();
  let total = 0;
  for (const seg of new Intl.Segmenter('en', { granularity: 'word' }).segment(input)) {
    if (!seg.isWordLike) continue;
    const word = ignoreCase ? seg.segment.toLocaleLowerCase() : seg.segment;
    total++;
    if ([...word].length < minLength) continue;
    if (excludeStopWords && STOP_WORDS.has(word.toLowerCase())) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, share: total ? `${((count / total) * 100).toFixed(2)}%` : '0%' }));
  return { rows, totalWords: total, uniqueWords: counts.size };
}
