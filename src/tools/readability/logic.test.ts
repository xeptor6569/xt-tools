import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { readability, syllables } from './logic.ts';

const as = (s: string) => Object.fromEntries(readability(s).map((v) => [v.label, Number.parseFloat(v.value)]));

describe('readability', () => {
  it.each([
    ['cat', 1],
    ['table', 2],
    ['beautiful', 3],
    ['readability', 5],
    ['the', 1],
    ['make', 1],
    ['created', 2],
  ])('syllables(%s) = %i', (word, n) => expect(syllables(word)).toBe(n));

  it('scores simple text as easy and dense text as hard', () => {
    const easy = as('The cat sat on the mat. The dog ran to the park. We had fun in the sun.');
    const hard = as(
      'Notwithstanding considerable methodological heterogeneity, contemporary epidemiological investigations consistently demonstrate statistically significant associations.',
    );
    expect(easy['Flesch reading ease']).toBeGreaterThan(90);
    expect(easy['Flesch–Kincaid grade']).toBeLessThan(3);
    expect(hard['Flesch reading ease']).toBeLessThan(0);
    expect(hard['Gunning fog index']).toBeGreaterThan(17);
  });

  it('counts words and sentences', () => {
    const r = as('One two three. Four five!');
    expect(r.Words).toBe(5);
    expect(r.Sentences).toBe(2);
  });

  it('returns nothing without words', () => {
    expect(readability('123 !!!')).toEqual([]);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(readability, { timeLimitMs: 10_000 });
  });
});
