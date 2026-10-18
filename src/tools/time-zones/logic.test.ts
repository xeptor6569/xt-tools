import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { formatOffset, offsetMinutes, timeZones, zonedToUtc } from './logic.ts';

describe('time zones', () => {
  it('reads wall-clock time in a zone', () => {
    expect(new Date(zonedToUtc('2026-10-14 15:30', 'Europe/Paris').ms).toISOString()).toBe('2026-10-14T13:30:00.000Z');
    expect(new Date(zonedToUtc('2026-01-14 09:00', 'America/New_York').ms).toISOString()).toBe(
      '2026-01-14T14:00:00.000Z',
    );
    expect(new Date(zonedToUtc('2026-01-14T09:00', 'Asia/Kathmandu').ms).toISOString()).toBe(
      '2026-01-14T03:15:00.000Z',
    );
  });

  it('handles daylight-saving gaps', () => {
    const r = zonedToUtc('2026-03-29 02:30', 'Europe/Paris');
    expect(r.note).toMatch(/doesn’t exist/);
  });

  it('computes offsets', () => {
    expect(offsetMinutes(Date.parse('2026-07-01T00:00:00Z'), 'Europe/London')).toBe(60);
    expect(offsetMinutes(Date.parse('2026-07-01T00:00:00Z'), 'America/Los_Angeles')).toBe(-420);
    expect(formatOffset(330)).toBe('UTC+05:30');
    expect(formatOffset(-210)).toBe('UTC-03:30');
  });

  it('converts to target zones and marks day changes', () => {
    const r = timeZones('2026-10-14 23:00', 'America/New_York', ['UTC', 'Asia/Tokyo'])!;
    expect(r.utc).toBe('2026-10-15T03:00:00.000Z');
    expect(r.conversions.map((c) => [c.zone, c.offset, c.dayShift])).toEqual([
      ['America/New_York', 'UTC-04:00', 0],
      ['UTC', 'UTC+00:00', 1],
      ['Asia/Tokyo', 'UTC+09:00', 1],
    ]);
    expect(r.conversions[2]!.local).toBe('Thu, 15 Oct 2026, 12:00');
  });

  it('finds hours that are working hours everywhere', () => {
    const r = timeZones('2026-10-14 09:00', 'Europe/London', ['America/New_York'])!;
    expect(r.planner).toHaveLength(24);
    const good = r.planner.filter((p) => p.allWorking).map((p) => p.sourceHour);
    expect(good).toEqual(['14:00', '15:00', '16:00']);
  });

  it('rejects bad input', () => {
    expect(() => timeZones('tomorrow', 'UTC', [])).toThrow(ToolInputError);
    expect(() => timeZones('2026-02-30 10:00', 'UTC', [])).toThrow(/doesn’t exist in that month/);
    expect(() => timeZones('2026-10-14 10:00', 'Nowhere/City', [])).toThrow(/Unknown time zone/);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => timeZones(s, 'UTC', ['Asia/Tokyo']));
  });
});
