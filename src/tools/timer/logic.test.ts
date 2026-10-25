import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { formatCountdown, parseMinutes, POMODORO_MINUTES } from './logic.ts';

describe('timer', () => {
  it('parses minutes and formats a countdown', () => {
    expect(POMODORO_MINUTES).toBe(25);
    expect(parseMinutes('25')).toBe(25);
    expect(formatCountdown(25 * 60_000)).toBe('25:00');
    expect(formatCountdown(90_000)).toBe('01:30');
    expect(formatCountdown(90 * 60_000)).toBe('1:30:00');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('rejects zero and oversized durations', () => {
    expect(() => parseMinutes('0')).toThrow(ToolInputError);
    expect(() => parseMinutes('1441')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(parseMinutes);
  });
});
