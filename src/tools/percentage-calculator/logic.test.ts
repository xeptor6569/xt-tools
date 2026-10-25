import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { percentageCalculator } from './logic.ts';

describe('percentageCalculator', () => {
  it('answers the three common questions', () => {
    expect(percentageCalculator('20% of 80')).toBe('16');
    expect(percentageCalculator('20 is what % of 80')).toBe('25%');
    expect(percentageCalculator('from 80 to 100')).toBe('25% increase (+20)');
  });

  it('handles a decrease and a reverse percentage', () => {
    expect(percentageCalculator('from 100 to 80')).toBe('20% decrease (-20)');
    expect(percentageCalculator('80 is 20% of what')).toBe('400');
    expect(percentageCalculator('20% of 80\nfrom 80 to 100')).toBe('16\n25% increase (+20)');
  });

  it('rejects division by zero', () => {
    expect(() => percentageCalculator('from 0 to 10')).toThrow(ToolInputError);
    expect(() => percentageCalculator('nope')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(percentageCalculator);
  });
});
