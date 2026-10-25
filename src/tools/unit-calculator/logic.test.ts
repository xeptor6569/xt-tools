import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { formatNumber } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';
import { unitCalculator } from './logic.ts';

describe('unitCalculator', () => {
  it('adds compatible lengths and converts temperature', () => {
    expect(unitCalculator('5 km + 20 m')).toBe('5.02 km');
    expect(unitCalculator('20 m + 5 km')).toBe('5020 m');
    expect(unitCalculator('10 F to C')).toBe('-12.2222222222 °C');
    expect(unitCalculator('32 F to C')).toBe('0 °C');
    expect(unitCalculator('-40 F to C')).toBe('-40 °C');
    expect(unitCalculator('100 C to F')).toBe('212 °F');
    expect(unitCalculator('1 ft to in')).toBe('12 in');
    expect(unitCalculator('10 km/h to m/s')).toBe(`${formatNumber(25 / 9)} m/s`);
  });

  it('keeps ordinary arithmetic and rejects mixed dimensions', () => {
    expect(unitCalculator('sqrt(4)')).toBe('2');
    expect(unitCalculator('2^10')).toBe('1024');
    expect(() => unitCalculator('5 km + 2 kg')).toThrow(ToolInputError);
    expect(() => unitCalculator('10 F + 5 C')).toThrow(ToolInputError);
    expect(() => unitCalculator('10 F to km')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(unitCalculator);
  });
});
