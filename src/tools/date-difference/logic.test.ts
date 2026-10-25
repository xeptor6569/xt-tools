import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { businessDays, dateDifference } from './logic.ts';

function oracle(start: Date, end: Date): number {
  let count = 0;
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

describe('dateDifference', () => {
  it('counts calendar days and Mon–Fri business days', () => {
    const text = dateDifference('2026-01-01 2026-01-31');
    expect(text).toContain('Calendar days: 30');
    expect(text).toContain('Business days (Mon–Fri): 22');
    expect(dateDifference('2026-01-31 2026-01-01')).toContain('Calendar days: 30');
  });

  it('matches a day-by-day count, including a weekend and a leap day', () => {
    const friday = new Date(Date.UTC(2026, 0, 2));
    const monday = new Date(Date.UTC(2026, 0, 5));
    expect(businessDays(friday, monday)).toBe(1);
    expect(businessDays(friday, monday)).toBe(oracle(friday, monday));
    expect(dateDifference('2026-01-02 2026-01-05')).toContain('Calendar days: 3');
    expect(dateDifference('2026-01-02 2026-01-05')).toContain('Business days (Mon–Fri): 1');
    expect(dateDifference('2024-02-28 2024-03-01')).toContain('Calendar days: 2');
    expect(dateDifference('2023-02-28 2023-03-01')).toContain('Calendar days: 1');
    expect(dateDifference('2026-01-01 2026-01-01')).toContain('Calendar days: 0');
    const spanStart = new Date(Date.UTC(2026, 0, 1));
    const spanEnd = new Date(Date.UTC(2026, 5, 15));
    expect(businessDays(spanStart, spanEnd)).toBe(oracle(spanStart, spanEnd));
  });

  it('rejects dates that do not exist', () => {
    expect(() => dateDifference('2026-02-31 2026-03-01')).toThrow(ToolInputError);
    expect(() => dateDifference('yesterday today')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(dateDifference);
  });
});
