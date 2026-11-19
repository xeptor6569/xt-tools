import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { cronFields, crontab, PRESETS, setCronField } from './logic.ts';

const now = new Date('2026-10-14T08:07:30Z');
const runs = (expr: string, count = 3) =>
  crontab(expr, { now, count, zone: 'UTC' })?.nextRuns.map((d) => d.toISOString());

describe('crontab', () => {
  it('explains an expression', () => {
    expect(crontab('*/15 9-17 * * 1-5', { now, zone: 'UTC' })?.description).toBe(
      'Every 15 minutes, between 09:00 and 17:59, Monday through Friday (UTC)',
    );
  });

  it('lists the next runs', () => {
    expect(runs('*/15 9-17 * * 1-5')).toEqual([
      '2026-10-14T09:00:00.000Z',
      '2026-10-14T09:15:00.000Z',
      '2026-10-14T09:30:00.000Z',
    ]);
    expect(runs('0 0 1 * *', 2)).toEqual(['2026-11-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z']);
  });

  it('uses Vixie-cron OR semantics when both day fields are set', () => {
    // The 13th of the month OR any Friday.
    expect(runs('0 0 13 * 5', 2)).toEqual(['2026-10-16T00:00:00.000Z', '2026-10-23T00:00:00.000Z']);
  });

  it('supports nicknames, names and a seconds field', () => {
    expect(runs('@daily', 1)).toEqual(['2026-10-15T00:00:00.000Z']);
    expect(runs('0 12 * JAN,JUL SUN', 1)).toEqual(['2027-01-03T12:00:00.000Z']);
    expect(runs('30 * * * * *', 1)).toEqual(['2026-10-14T08:08:30.000Z']);
    expect(crontab('30 * * * * *', { now })?.fields[0]?.name).toBe('Second');
  });

  it('breaks the expression into fields', () => {
    expect(crontab('5 4 * * sun', { now })?.fields.map((f) => [f.name, f.value])).toEqual([
      ['Minute', '5'],
      ['Hour', '4'],
      ['Day of month', '*'],
      ['Month', '*'],
      ['Day of week', 'sun'],
    ]);
  });

  it('builds an expression from the five fields', () => {
    expect(cronFields('0 9 * * 1-5')).toEqual(['0', '9', '*', '*', '1-5']);
    expect(cronFields('@daily')).toEqual(['0', '0', '*', '*', '*']);
    expect(cronFields('30 0 9 * * 1-5')).toEqual(['0', '9', '*', '*', '1-5']);
    expect(cronFields('')).toBeUndefined();
    expect(cronFields('not a cron')).toBeUndefined();
    expect(setCronField('0 9 * * 1-5', 0, '15')).toBe('15 9 * * 1-5');
    expect(setCronField('@weekly', 3, 'JAN')).toBe('0 0 * JAN 0');
    expect(setCronField('30 * * * * *', 1, '4')).toBe('30 * 4 * * *');
    expect(setCronField('not a cron', 2, '1')).toBe('* * 1 * *');
    expect(setCronField('* * * * *', 4, '1, 5')).toBe('* * * * 1,5');
    expect(crontab(setCronField('* * * * *', 4, '1-5'), { now })?.description).toContain('Monday through Friday');
    expect(() => setCronField('* * * * *', 0, '   ')).toThrow(ToolInputError);
    expect(() => setCronField('* * * * *', 5, '*')).toThrow(ToolInputError);
  });

  it('every preset is valid', () => {
    for (const p of PRESETS) expect(crontab(p.expression, { now })?.nextRuns).toHaveLength(10);
  });

  it('rejects invalid expressions with a clear message', () => {
    for (const bad of ['61 * * * *', '* * *', '* * * * * * *', '* 25 * * *', 'every day']) {
      expect(() => crontab(bad, { now }), bad).toThrow(ToolInputError);
    }
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => crontab(s, { now }), { malformed: ['*/0 * * * *', '1-0 * * * *', ', * * * *', '? ? ? ? ?'] });
  });
});
