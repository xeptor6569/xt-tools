import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import {
  DIGITS,
  LOWER,
  SYMBOLS,
  UPPER,
  parseCount,
  parseLength,
  passphraseGenerator,
  passwordBits,
  passwordGenerator,
  type PasswordOptions,
} from './logic.ts';

const zeros = (n: number) => new Uint8Array(n);

const allOn: PasswordOptions = {
  length: 8,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

describe('passwordGenerator', () => {
  it('is deterministic for a fixed random source', () => {
    expect(passwordGenerator(1, { ...allOn, lower: true, upper: false, digits: false, symbols: false }, zeros)).toEqual(
      ['a'.repeat(8)],
    );
    expect(passwordGenerator(1, { ...allOn, upper: false, symbols: false }, zeros)).toEqual(['0aaaaaaa']);
  });

  it('uses every selected set and stays inside the alphabet', () => {
    const [password] = passwordGenerator(1, { ...allOn, excludeAmbiguous: true }, (n) =>
      crypto.getRandomValues(new Uint8Array(n)),
    );
    expect(password).toHaveLength(8);
    const lower = LOWER.replace(/[lo]/g, '');
    const upper = UPPER.replace(/[IO]/g, '');
    const digits = DIGITS.replace(/[01]/g, '');
    expect(password!.split('').some((char) => lower.includes(char))).toBe(true);
    expect(password!.split('').some((char) => upper.includes(char))).toBe(true);
    expect(password!.split('').some((char) => digits.includes(char))).toBe(true);
    expect(password!.split('').some((char) => SYMBOLS.includes(char))).toBe(true);
    expect(password).toMatch(
      new RegExp(`^[${lower}${upper}${digits}${SYMBOLS.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}]+$`),
    );
    expect(password).not.toMatch(/[loIO01]/);
  });

  it('reports charset entropy and rejects an empty alphabet', () => {
    expect(passwordBits({ ...allOn, length: 10, upper: false, digits: false, symbols: false })).toBeCloseTo(47, 0);
    expect(() =>
      passwordGenerator(1, { ...allOn, lower: false, upper: false, digits: false, symbols: false }, zeros),
    ).toThrow(ToolInputError);
    expect(() => passwordGenerator(1, { ...allOn, length: 2 }, zeros)).toThrow(ToolInputError);
  });
});

describe('passphraseGenerator', () => {
  const words = ['aa', 'bb', 'cc', 'dd'];

  it('joins EFF-style words and can capitalize them', () => {
    expect(passphraseGenerator(1, { words: 4, separator: 'space', capitalize: false }, words, zeros)).toEqual([
      'aa aa aa aa',
    ]);
    expect(passphraseGenerator(1, { words: 4, separator: 'hyphen', capitalize: true }, words, zeros)).toEqual([
      'Aa-Aa-Aa-Aa',
    ]);
    expect(passphraseGenerator(2, { words: 4, separator: 'none', capitalize: true }, words, zeros)).toEqual([
      'AaAaAaAa',
      'AaAaAaAa',
    ]);
  });
});

describe('parsers', () => {
  it('parses count and length', () => {
    expect(parseCount('')).toBe(1);
    expect(parseCount('3')).toBe(3);
    expect(() => parseCount('0')).toThrow(ToolInputError);
    expect(parseLength('')).toBe(20);
    expect(parseLength('12')).toBe(12);
    expect(() => parseLength('3')).toThrow(ToolInputError);
    expect(() => parseLength('129')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(parseCount);
    expectRobust(parseLength);
  });
});
