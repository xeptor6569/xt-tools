import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { textDiff } from './logic.ts';

describe('textDiff', () => {
  it('compares lines', () => {
    const r = textDiff('a\nb\nc\n', 'a\nc\nd\n');
    expect(r.parts).toEqual([
      { kind: 'same', text: 'a\n' },
      { kind: 'removed', text: 'b\n' },
      { kind: 'same', text: 'c\n' },
      { kind: 'added', text: 'd\n' },
    ]);
    expect([r.added, r.removed]).toEqual([1, 1]);
  });

  it('compares words', () => {
    const r = textDiff('the quick brown fox', 'the slow brown fox', { mode: 'words' });
    expect(r.parts.filter((p) => p.kind !== 'same').map((p) => [p.kind, p.text])).toEqual([
      ['removed', 'quick'],
      ['added', 'slow'],
    ]);
  });

  it('compares characters', () => {
    const r = textDiff('colour', 'color', { mode: 'chars' });
    expect(r.parts).toEqual([
      { kind: 'same', text: 'colo' },
      { kind: 'removed', text: 'u' },
      { kind: 'same', text: 'r' },
    ]);
  });

  it('can ignore case and whitespace', () => {
    expect(textDiff('Hello  World', 'hello world', { ignoreCase: true, ignoreWhitespace: true }).identical).toBe(true);
    expect(textDiff('Hello', 'hello').identical).toBe(false);
  });

  it('limits character mode', () => {
    expect(() => textDiff('a'.repeat(30_000), 'b'.repeat(30_000), { mode: 'chars' })).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => textDiff(s, 'other text'), { timeLimitMs: 10_000 });
    expectRobust((s) => textDiff('some text', s, { mode: 'words' }), { timeLimitMs: 10_000 });
  });
});
