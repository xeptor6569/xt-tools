import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { dateTime, isoInZone, parseDate, relative } from './logic.ts';

const now = Date.parse('2026-10-14T12:00:00Z');
const as = (input: string, timeZone = 'UTC') =>
  Object.fromEntries(dateTime(input, { now, timeZone }).single?.map((v) => [v.label, v.value]) ?? []);

describe('parseDate', () => {
  it.each([
    ['1760443200', Date.parse('2025-10-14T12:00:00Z'), 'Unix seconds'],
    ['1760443200123', Date.parse('2025-10-14T12:00:00.123Z'), 'Unix milliseconds'],
    ['1760443200123456', Date.parse('2025-10-14T12:00:00.123Z') + 0.456, 'Unix microseconds'],
    ['1760443200.5', Date.parse('2025-10-14T12:00:00.500Z'), 'Unix seconds'],
    ['0', 0, 'Unix seconds'],
    ['-86400', -86_400_000, 'Unix seconds'],
    ['2026-10-14T10:00:00+02:00', Date.parse('2026-10-14T08:00:00Z'), 'ISO 8601'],
    ['Wed, 14 Oct 2026 08:00:00 GMT', Date.parse('2026-10-14T08:00:00Z'), 'Date text'],
  ])('%s', (input, ms, kind) => {
    const r = parseDate(input);
    expect(r.ms).toBeCloseTo(ms, 0);
    expect(r.as).toBe(kind);
  });

  it('rejects text it cannot read and out-of-range numbers', () => {
    expect(() => parseDate('next tuesday')).toThrow(ToolInputError);
    expect(() => parseDate('99999999999999999999999')).toThrow(/outside the range/);
  });
});

describe('formats', () => {
  it('shows every format for one date', () => {
    const r = as('2026-10-14T08:30:00Z');
    expect(r['Unix seconds']).toBe('1791966600');
    expect(r['ISO 8601 (UTC)']).toBe('2026-10-14T08:30:00.000Z');
    expect(r['RFC 2822 / HTTP date']).toBe('Wed, 14 Oct 2026 08:30:00 GMT');
    expect(r.Relative).toBe('4 hours ago');
    expect(r['ISO week (UTC)']).toBe('2026-W42');
    expect(r['Day of year (UTC)']).toBe('287');
  });

  it('converts to a chosen time zone', () => {
    expect(isoInZone(Date.parse('2026-10-14T08:30:00Z'), 'Europe/Paris')).toBe('2026-10-14T10:30:00.000+02:00');
    expect(isoInZone(Date.parse('2026-01-14T08:30:00Z'), 'America/New_York')).toBe('2026-01-14T03:30:00.000-05:00');
    expect(isoInZone(Date.parse('2026-01-14T08:30:00Z'), 'Asia/Kolkata')).toBe('2026-01-14T14:00:00.000+05:30');
    expect(as('0', 'Europe/London')['Local (Europe/London)']).toMatch(/1 January 1970/);
  });

  it('gets ISO week numbers right at year boundaries', () => {
    expect(as('2027-01-01T00:00:00Z')['ISO week (UTC)']).toBe('2026-W53');
    expect(as('2024-12-30T00:00:00Z')['ISO week (UTC)']).toBe('2025-W01');
  });

  it('describes relative times', () => {
    expect(relative(now + 86_400_000, now)).toBe('tomorrow');
    expect(relative(now - 3 * 365.25 * 86_400_000, now)).toBe('3 years ago');
    expect(relative(now + 30_000, now)).toBe('in 30 seconds');
  });
});

describe('batch mode', () => {
  it('converts one date per line and reports bad lines', () => {
    const r = dateTime('0\n1700000000\nnonsense', { now });
    expect(r.batch?.map((row) => row.iso)).toEqual(['1970-01-01T00:00:00.000Z', '2023-11-14T22:13:20.000Z', '']);
    expect(r.batch?.[2]?.error).toMatch(/isn't a date/);
  });

  it('rejects unknown time zones', () => {
    expect(() => dateTime('0', { timeZone: 'Mars/Olympus' })).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => dateTime(s, { now }), { malformed: ['1e999', '--1', '2026-13-45', '\n\n\n'] });
  });
});
