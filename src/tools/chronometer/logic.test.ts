import { describe, expect, it } from 'vitest';
import { ToolInputError } from '../types.ts';
import { formatElapsed, formatLaps } from './logic.ts';

describe('chronometer', () => {
  it('formats elapsed time and lap splits', () => {
    expect(formatElapsed(0)).toBe('00:00:00.000');
    expect(formatElapsed(1000)).toBe('00:00:01.000');
    expect(formatElapsed(61_000)).toBe('00:01:01.000');
    expect(formatElapsed(3_661_123)).toBe('01:01:01.123');
    expect(formatLaps([1500, 4000])).toBe(
      'Lap 1: 00:00:01.500 (at 00:00:01.500)\nLap 2: 00:00:02.500 (at 00:00:04.000)',
    );
  });

  it('rejects a negative duration', () => {
    expect(() => formatElapsed(-1)).toThrow(ToolInputError);
    expect(() => formatElapsed(Number.NaN)).toThrow(ToolInputError);
  });
});
