import { ToolInputError } from '../types.ts';

export interface Conversion {
  zone: string;
  /** e.g. "Wed 14 Oct 2026, 15:30" */
  local: string;
  /** e.g. "UTC+02:00" */
  offset: string;
  /** Days relative to the source date: -1, 0 or +1. */
  dayShift: number;
}

export interface PlannerRow {
  sourceHour: string;
  cells: Array<{ zone: string; time: string; working: boolean }>;
  allWorking: boolean;
}

export interface TimeZoneResult {
  utc: string;
  conversions: Conversion[];
  planner: PlannerRow[];
  note: string | undefined;
}

const WORK_START = 9;
const WORK_END = 17;

function fields(ms: number, zone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    })
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  return {
    y: Number(p.year),
    mo: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    mi: Number(p.minute),
    weekday: p.weekday ?? '',
  };
}

/** Offset of `zone` from UTC at instant `ms`, in minutes. */
export function offsetMinutes(ms: number, zone: string): number {
  const f = fields(ms, zone);
  return Math.round((Date.UTC(f.y, f.mo - 1, f.d, f.h, f.mi) - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export function assertZone(zone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
  } catch {
    throw new ToolInputError(`Unknown time zone "${zone}".`);
  }
}

/** Parses "YYYY-MM-DD HH:mm" (or with T) as wall-clock time in `zone`. */
export function zonedToUtc(text: string, zone: string): { ms: number; note: string | undefined } {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) throw new ToolInputError('Enter a date and time like 2026-10-14 15:30.');
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59)
    throw new ToolInputError('That date or time is out of range.');
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(wall);
  if (check.getUTCDate() !== d) throw new ToolInputError('That day doesn’t exist in that month.');
  // Two passes settle the offset, including across DST changes.
  let ms = wall - offsetMinutes(wall, zone) * 60_000;
  ms = wall - offsetMinutes(ms, zone) * 60_000;
  const back = fields(ms, zone);
  const note =
    back.h !== h || back.mi !== mi
      ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} doesn’t exist in ${zone} that day (clocks went forward); showing ${String(back.h).padStart(2, '0')}:${String(back.mi).padStart(2, '0')}.`
      : undefined;
  return { ms, note };
}

function dayNumber(ms: number, zone: string): number {
  const f = fields(ms, zone);
  return Date.UTC(f.y, f.mo - 1, f.d) / 86_400_000;
}

export function timeZones(input: string, source: string, targets: readonly string[]): TimeZoneResult | undefined {
  if (input.length > 100) throw new ToolInputError('Input is too long.');
  if (input.trim() === '') return undefined;
  if (targets.length > 30) throw new ToolInputError('Pick at most 30 time zones.');
  [source, ...targets].forEach(assertZone);
  const { ms, note } = zonedToUtc(input, source);
  const sourceDay = dayNumber(ms, source);
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  const conversions = [source, ...targets.filter((t) => t !== source)].map((zone) => ({
    zone,
    local: fmt(zone).format(ms),
    offset: formatOffset(offsetMinutes(ms, zone)),
    dayShift: dayNumber(ms, zone) - sourceDay,
  }));

  // Meeting planner: each hour of the source day, as seen in every zone.
  const midnight = zonedToUtc(`${input.trim().slice(0, 10)} 00:00`, source).ms;
  const zones = conversions.map((c) => c.zone);
  const time = (t: number, zone: string) => {
    const f = fields(t, zone);
    return {
      label: `${String(f.h).padStart(2, '0')}:${String(f.mi).padStart(2, '0')}${dayNumber(t, zone) !== sourceDay ? (dayNumber(t, zone) > sourceDay ? ' +1' : ' −1') : ''}`,
      hour: f.h,
      weekday: f.weekday,
    };
  };
  const planner: PlannerRow[] = Array.from({ length: 24 }, (_, i) => {
    const t = midnight + i * 3_600_000;
    const cells = zones.map((zone) => {
      const v = time(t, zone);
      const weekend = v.weekday === 'Sat' || v.weekday === 'Sun';
      return { zone, time: v.label, working: !weekend && v.hour >= WORK_START && v.hour < WORK_END };
    });
    return { sourceHour: cells[0]?.time ?? '', cells, allWorking: cells.every((c) => c.working) };
  });

  return { utc: new Date(ms).toISOString(), conversions, planner, note };
}
