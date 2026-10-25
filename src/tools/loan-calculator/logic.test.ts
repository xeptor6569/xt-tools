import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { loanCalculator } from './logic.ts';

describe('loanCalculator', () => {
  it('computes a standard monthly payment and the interest', () => {
    const text = loanCalculator('principal 1000 rate 5 years 2');
    expect(text).toContain('Monthly payment: 43.87');
    expect(text).toContain('Total interest: 52.88');
    expect(text).toContain('Total paid: 1052.88');
    expect(text).toContain('Payments: 24');
  });

  it('handles a zero rate and monthly compound growth', () => {
    const zero = loanCalculator('principal 1200 rate 0 years 1');
    expect(zero).toContain('Monthly payment: 100.00');
    expect(zero).toContain('Total interest: 0.00');
    const compound = loanCalculator('compound principal 1000 rate 5 years 2');
    expect(compound).toContain('Future value: 1104.94');
    expect(compound).toContain('Interest earned: 104.94');
  });

  it('rejects a negative principal', () => {
    expect(() => loanCalculator('principal -1 rate 5 years 2')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(loanCalculator);
  });
});
