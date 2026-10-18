import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { fromRoman, romanNumerals, toRoman } from './logic.ts';

describe('roman numerals', () => {
  it.each([
    [1, 'I'],
    [4, 'IV'],
    [9, 'IX'],
    [14, 'XIV'],
    [40, 'XL'],
    [90, 'XC'],
    [400, 'CD'],
    [1994, 'MCMXCIV'],
    [2026, 'MMXXVI'],
    [3999, 'MMMCMXCIX'],
  ])('%i ⇄ %s', (n, roman) => {
    expect(toRoman(n)).toBe(roman);
    expect(fromRoman(roman)).toBe(n);
    expect(fromRoman(roman.toLowerCase())).toBe(n);
  });

  it('round-trips every value', () => {
    for (let n = 1; n <= 3999; n++) expect(fromRoman(toRoman(n))).toBe(n);
  });

  it('rejects out-of-range numbers and non-standard numerals', () => {
    expect(() => toRoman(0)).toThrow(ToolInputError);
    expect(() => toRoman(4000)).toThrow(/1 to 3999/);
    for (const bad of ['IIII', 'VV', 'IC', 'XM', 'MMMM', 'IL'])
      expect(() => fromRoman(bad), bad).toThrow(ToolInputError);
  });

  it('converts line by line in both directions', () => {
    expect(romanNumerals('2026\nxiv\n\n1')).toBe('MMXXVI\n14\n\nI');
    expect(() => romanNumerals('12a')).toThrow(/neither a number nor/);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(romanNumerals);
  });
});
