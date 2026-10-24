import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { currencyUrl, localConversion, parseAmount, parseFrankfurter } from './logic.ts';

describe('parseAmount', () => {
  it('accepts a plain decimal', () => {
    expect(parseAmount('12.5')).toBe(12.5);
  });

  it('rejects zero, signs and too many decimals', () => {
    expect(() => parseAmount('0')).toThrow(/greater than zero/);
    expect(() => parseAmount('-2')).toThrow(/greater than zero/);
    expect(() => parseAmount('1.1234567')).toThrow(/6 decimal/);
  });

  it('stays inside ToolInputError for garbage', () => {
    expectRobust(parseAmount);
  });
});

describe('currency conversion', () => {
  it('keeps an identity conversion local', () => {
    expect(currencyUrl(12.5, 'USD', 'USD')).toBeUndefined();
    expect(localConversion(12.5, 'USD')).toEqual({
      amount: '12.5',
      from: 'USD',
      to: 'USD',
      converted: '12.5',
      rate: '1',
    });
  });

  it('reads a Frankfurter amount response', () => {
    expect(currencyUrl(12.5, 'USD', 'EUR')).toBe('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR&amount=12.5');
    expect(
      parseFrankfurter({ amount: 12.5, base: 'USD', date: '2026-10-23', rates: { EUR: 11.1677 } }, 'USD', 'EUR', 12.5),
    ).toEqual({
      amount: '12.5',
      from: 'USD',
      to: 'EUR',
      converted: '11.1677',
      rate: '0.893416',
      date: '2026-10-23',
    });
  });
});
