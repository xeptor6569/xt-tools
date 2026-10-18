import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { invisibleChars } from './logic.ts';

describe('invisibleChars', () => {
  it('finds zero-width characters and reports where they are', () => {
    const r = invisibleChars('ab\u200bc\nd\ufeff');
    expect(r.findings.map((f) => [f.codePoint, f.line, f.column, f.kind])).toEqual([
      ['U+200B', 1, 3, 'invisible'],
      ['U+FEFF', 2, 2, 'invisible'],
    ]);
    expect(r.cleaned).toBe('abc\nd');
  });

  it('finds bidirectional overrides (Trojan Source)', () => {
    const r = invisibleChars('access = "user\u202e \u2066// admin\u2069"');
    expect(r.findings.map((f) => f.name)).toEqual([
      'Right-to-left override',
      'Left-to-right isolate',
      'Pop directional isolate',
    ]);
  });

  it('finds look-alike letters and fullwidth characters', () => {
    const r = invisibleChars('pаypal.com ＡＢ');
    expect(r.findings.map((f) => [f.char, f.replacement])).toEqual([
      ['а', 'a'],
      ['Ａ', 'A'],
      ['Ｂ', 'B'],
    ]);
    expect(r.cleaned).toBe('paypal.com AB');
  });

  it('normalises unusual spaces', () => {
    expect(invisibleChars('a\u00a0b\u2009c').cleaned).toBe('a b c');
  });

  it('leaves emoji sequences and plain text alone', () => {
    expect(invisibleChars('👩‍👩‍👧 ❤️ hello\tworld\n').findings).toEqual([]);
  });

  it('flags tag characters that can hide text', () => {
    expect(invisibleChars('hi\u{E0068}\u{E0069}').findings).toHaveLength(2);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(invisibleChars, { timeLimitMs: 10_000 });
  });
});
