import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { integerWords, numberToWords, ordinalSuffix } from './logic.ts';

const as = (input: string, british = false) =>
  Object.fromEntries(numberToWords(input, { british }).map((v) => [v.label, v.value]));

describe('numberToWords', () => {
  it.each([
    ['0', 'zero'],
    ['7', 'seven'],
    ['13', 'thirteen'],
    ['21', 'twenty-one'],
    ['100', 'one hundred'],
    ['101', 'one hundred one'],
    ['1000', 'one thousand'],
    ['1001', 'one thousand one'],
    ['1234567', 'one million two hundred thirty-four thousand five hundred sixty-seven'],
    ['1000000000000', 'one trillion'],
  ])('%s', (n, words) => expect(integerWords(n)).toBe(words));

  it('supports the British "and"', () => {
    expect(integerWords('101', true)).toBe('one hundred and one');
    expect(integerWords('1005', true)).toBe('one thousand and five');
    expect(integerWords('2350', true)).toBe('two thousand three hundred and fifty');
  });

  it('builds ordinals', () => {
    expect(as('1').Ordinal).toBe('first');
    expect(as('12').Ordinal).toBe('twelfth');
    expect(as('20').Ordinal).toBe('twentieth');
    expect(as('103').Ordinal).toBe('one hundred third');
    expect(['1', '2', '3', '4', '11', '12', '13', '21', '112', '1001'].map(ordinalSuffix)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '112th',
      '1,001st',
    ]);
  });

  it('handles negatives, decimals and cheques', () => {
    expect(as('-42').Words).toBe('minus forty-two');
    expect(as('3.14').Words).toBe('three point one four');
    expect(as('1,234.5')['Cheque style']).toBe('One thousand two hundred thirty-four and 50/100');
    expect(as('-0').Words).toBe('zero');
  });

  it('handles very large numbers', () => {
    expect(integerWords('1' + '0'.repeat(63))).toBe('one vigintillion');
  });

  it('rejects input it cannot spell', () => {
    expect(() => numberToWords('12abc')).toThrow(ToolInputError);
    expect(() => numberToWords('1' + '0'.repeat(66))).toThrow(/digits are supported/);
    expect(() => numberToWords('1e5')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => numberToWords(s));
  });
});
