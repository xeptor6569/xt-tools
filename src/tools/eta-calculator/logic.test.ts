import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { etaCalculator } from './logic.ts';

describe('etaCalculator', () => {
  it('estimates a remaining duration from a percent', () => {
    const text = etaCalculator('50% in 10 min');
    expect(text).toContain('Remaining: 600 seconds (10 min)');
    expect(text).toContain('ETA: 600 seconds (10 min)');
    expect(text).toContain('Progress: 50%');
  });

  it('estimates from a count of finished items', () => {
    const text = etaCalculator('done 25 of 100 in 600 seconds');
    expect(text).toContain('Remaining: 1800 seconds (30 min)');
    expect(text).toContain('ETA: 1800 seconds (30 min)');
    expect(text).toContain('Progress: 25%');
  });

  it('rejects progress that cannot be projected', () => {
    expect(etaCalculator('100% in 5 min')).toContain('Remaining: 0 seconds');
    expect(() => etaCalculator('0% in 5 min')).toThrow(ToolInputError);
    expect(() => etaCalculator('done 0 of 100 in 10 min')).toThrow(ToolInputError);
    expect(() => etaCalculator('done 101 of 100 in 10 min')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(etaCalculator);
  });
});
