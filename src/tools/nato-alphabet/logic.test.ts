import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { decode, encode, looksEncoded, natoAlphabet } from './logic.ts';

describe('NATO alphabet', () => {
  it('spells text out', () => {
    expect(encode('SOS')).toBe('Sierra Oscar Sierra');
    expect(encode('Hi 42')).toBe('Hotel India / Four Two');
    expect(encode('a-b')).toBe('Alfa - Bravo');
  });

  it('decodes code words, including alternative spellings', () => {
    expect(decode('Hotel India / Four Two')).toBe('HI 42');
    expect(decode('alpha juliet xray niner')).toBe('AJX9');
    expect(decode('Bravo Banana')).toBe('B[Banana]');
  });

  it('detects the direction', () => {
    expect(looksEncoded('Charlie Delta Echo')).toBe(true);
    expect(looksEncoded('hello world')).toBe(false);
    expect(natoAlphabet('Kilo Lima')).toBe('KL');
    expect(natoAlphabet('KL')).toBe('Kilo Lima');
    expect(natoAlphabet('Kilo', 'encode')).toBe('Kilo India Lima Oscar');
  });

  it('round-trips', () => {
    expect(decode(encode('XT TOOLS 2026'))).toBe('XT TOOLS 2026');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => natoAlphabet(s));
    expectRobust((s) => natoAlphabet(s, 'decode'));
  });
});
