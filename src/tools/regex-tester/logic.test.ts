import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { MAX_MATCHES, regexTest, segments } from './logic.ts';

describe('regexTest', () => {
  it('finds every match with the g flag', () => {
    const r = regexTest('\\d+', 'g', 'a1 b22 c333');
    expect(r.matches.map((m) => [m.index, m.text])).toEqual([
      [1, '1'],
      [4, '22'],
      [8, '333'],
    ]);
  });

  it('finds only the first match without g', () => {
    expect(regexTest('\\d+', '', 'a1 b22').matches).toHaveLength(1);
  });

  it('reports numbered and named groups', () => {
    const [m] = regexTest('(?<year>\\d{4})-(\\d{2})', 'g', 'on 2026-10 and').matches;
    expect(m?.groups).toEqual([
      { name: '1', value: '2026' },
      { name: '2', value: '10' },
      { name: 'year', value: '2026' },
    ]);
  });

  it('handles flags: i, m, s, u, v, y', () => {
    expect(regexTest('abc', 'gi', 'ABC abc').matches).toHaveLength(2);
    expect(regexTest('^x', 'gm', 'x\nx').matches).toHaveLength(2);
    expect(regexTest('a.b', 's', 'a\nb').matches).toHaveLength(1);
    expect(regexTest('\\p{Emoji_Presentation}', 'gu', 'hi 🚀👍').matches).toHaveLength(2);
    expect(regexTest('[\\p{L}--[a-z]]', 'gv', 'aBc').matches.map((m) => m.text)).toEqual(['B']);
    expect(regexTest('a', 'y', 'ba').matches).toHaveLength(0);
  });

  it('copes with empty matches without looping forever', () => {
    expect(regexTest('x*', 'g', 'abc').matches).toHaveLength(4);
  });

  it('caps the number of matches', () => {
    const r = regexTest('.', 'g', 'a'.repeat(MAX_MATCHES + 5));
    expect(r.matches).toHaveLength(MAX_MATCHES);
    expect(r.truncated).toBe(true);
  });

  it('replaces with $1 and $<name>', () => {
    expect(regexTest('(?<w>\\w+)@(\\w+)', 'g', 'me@host you@there', '$2:$<w>').replaced).toBe('host:me there:you');
  });

  it('explains invalid patterns and flags', () => {
    expect(() => regexTest('(', 'g', 'x')).toThrow(ToolInputError);
    expect(() => regexTest('(', 'g', 'x')).toThrow(/Invalid pattern/);
    expect(() => regexTest('a', 'gg', 'x')).toThrow(/only be used once/);
    expect(() => regexTest('a', 'q', 'x')).toThrow(/Flags/);
    expect(() => regexTest('a', 'uv', 'x')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => regexTest(s, 'g', 'some text'));
    expectRobust((s) => regexTest('\\w+', 'g', s));
  });
});

describe('segments', () => {
  it('splits text around matches', () => {
    const text = 'a1 b22';
    const { matches } = regexTest('\\d+', 'g', text);
    expect(segments(text, matches)).toEqual([
      { text: 'a', match: -1 },
      { text: '1', match: 0 },
      { text: ' b', match: -1 },
      { text: '22', match: 1 },
    ]);
  });
});
