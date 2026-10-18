import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { wordFrequency } from './logic.ts';

describe('wordFrequency', () => {
  const text = 'The cat and the hat. The CAT sat!';

  it('counts words, ignoring case by default', () => {
    const r = wordFrequency(text);
    expect(r.rows.slice(0, 2)).toEqual([
      { word: 'the', count: 3, share: '37.50%' },
      { word: 'cat', count: 2, share: '25.00%' },
    ]);
    expect(r.totalWords).toBe(8);
    expect(r.uniqueWords).toBe(5);
  });

  it('can respect case, skip stop words and short words', () => {
    expect(wordFrequency(text, { ignoreCase: false }).rows.find((x) => x.word === 'CAT')?.count).toBe(1);
    expect(wordFrequency(text, { excludeStopWords: true }).rows.map((x) => x.word)).toEqual(['cat', 'hat', 'sat']);
    expect(wordFrequency('a bb ccc', { minLength: 2 }).rows.map((x) => x.word)).toEqual(['bb', 'ccc']);
  });

  it('handles accented and non-Latin words', () => {
    expect(wordFrequency('café café naïve').rows[0]).toMatchObject({ word: 'café', count: 2 });
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => wordFrequency(s), { timeLimitMs: 15_000 });
  });
});
