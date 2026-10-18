import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { textStats } from './logic.ts';

const as = (s: string) => Object.fromEntries(textStats(s).map((v) => [v.label, v.value]));

describe('textStats', () => {
  it('counts the basics', () => {
    const r = as('Hello world. How are you?\nFine!\n\nNew paragraph here.');
    expect(r.Words).toBe('9');
    expect(r.Sentences).toBe('4');
    expect(r.Lines).toBe('4');
    expect(r.Paragraphs).toBe('2');
  });

  it('counts user-perceived characters, not code units', () => {
    const r = as('👩‍👩‍👧 é');
    expect(r.Characters).toBe('3');
    expect(r['UTF-16 code units (JS length)']).toBe('10');
    expect(r['Bytes (UTF-8)']).toBe('21');
  });

  it('estimates reading time', () => {
    expect(as('word '.repeat(476))['Reading time']).toBe('2 min');
    expect(as('one two')['Reading time']).toBe('1 s');
  });

  it('handles empty input', () => {
    expect(as('')).toMatchObject({ Characters: '0', Words: '0', Lines: '0', Sentences: '0' });
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(textStats, { timeLimitMs: 10_000 });
  });
});
