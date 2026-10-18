import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

export interface DateTimeResult {
  /** One input: every format. Several lines: one row per line. */
  single: Variant[] | undefined;
  batch: Array<{ input: string; iso: string; unix: string; error?: string }> | undefined;
}

const MAX_INPUT = 200_000;
const MAX_LINES = 1000;
const MAX_MS = 8.64e15;

export interface ParsedDate {
  ms: number;
  /** How the input was read, e.g. "Unix seconds". */
  as: string;
}

/** Reads Unix timestamps (seconds to nanoseconds, by digit count), ISO 8601 and RFC 2822 dates. */
export function parseDate(text: string): ParsedDate {
  const s = text.trim();
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) {
    const [whole = ''] = s.replace(/^[-+]/, '').split('.');
    const n = Number(s);
    const digits = whole.replace(/^0+/, '').length;
    const [ms, as] =
      digits <= 11 || s.includes('.')
        ? [n * 1000, 'Unix seconds']
        : digits <= 14
          ? [n, 'Unix milliseconds']
          : digits <= 17
            ? [n / 1000, 'Unix microseconds']
            : [n / 1e6, 'Unix nanoseconds'];
    if (Math.abs(ms) > MAX_MS) throw new ToolInputError(`${s} is outside the range of dates this tool can show.`);
    return { ms, as };
  }
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) {
    throw new ToolInputError(
      `"${s.slice(0, 60)}" isn't a date I can read. Try a Unix timestamp, ISO 8601 or RFC 2822.`,
    );
  }
  return { ms, as: /^\d{4}-\d{2}-\d{2}/.test(s) ? 'ISO 8601' : 'Date text' };
}

function parts(ms: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    timeZoneName: 'longOffset',
  });
  return Object.fromEntries(fmt.formatToParts(ms).map((p) => [p.type, p.value]));
}

/** ISO 8601 with the zone's offset, e.g. 2026-10-14T10:00:00.000+02:00. */
export function isoInZone(ms: number, timeZone: string): string {
  const p = parts(ms, timeZone);
  const offset = (p.timeZoneName ?? 'GMT').replace('GMT', '') || '+00:00';
  const year = Number(p.year) < 0 || Number(p.year) > 9999 ? `${p.year}` : p.year;
  return `${year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${p.fractionalSecond}${offset === '+00:00' ? 'Z' : offset}`;
}

export function relative(ms: number, now: number): string {
  const diff = (ms - now) / 1000;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_557_600],
    ['month', 2_629_800],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds || unit === 'second') {
      return fmt.format(Math.sign(diff) * Math.round(Math.abs(diff) / seconds), unit);
    }
  }
  return '';
}

function isoWeek(ms: number): string {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const year = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const week =
    1 +
    Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function dayOfYear(ms: number): number {
  const d = new Date(ms);
  return Math.floor((ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
}

export function formats(ms: number, as: string, now: number, timeZone: string): Variant[] {
  const date = new Date(ms);
  const local = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone }).format(date);
  return [
    { label: 'Read as', value: as },
    { label: 'Unix seconds', value: String(Math.floor(ms / 1000)) },
    { label: 'Unix milliseconds', value: String(Math.floor(ms)) },
    { label: 'ISO 8601 (UTC)', value: date.toISOString() },
    { label: `ISO 8601 (${timeZone})`, value: isoInZone(ms, timeZone) },
    { label: 'RFC 2822 / HTTP date', value: date.toUTCString() },
    { label: `Local (${timeZone})`, value: local },
    { label: 'Relative', value: relative(ms, now) },
    { label: 'ISO week (UTC)', value: isoWeek(ms) },
    { label: 'Day of year (UTC)', value: String(dayOfYear(ms)) },
  ];
}

export function dateTime(input: string, { now = Date.now(), timeZone = 'UTC' } = {}): DateTimeResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const lines = input
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { single: undefined, batch: undefined };
  try {
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    throw new ToolInputError(`Unknown time zone "${timeZone}".`);
  }
  if (lines.length === 1) {
    const { ms, as } = parseDate(lines[0] ?? '');
    return { single: formats(ms, as, now, timeZone), batch: undefined };
  }
  if (lines.length > MAX_LINES) throw new ToolInputError(`Too many lines (maximum ${MAX_LINES}).`);
  return {
    single: undefined,
    batch: lines.map((line) => {
      try {
        const { ms } = parseDate(line);
        return { input: line, iso: new Date(ms).toISOString(), unix: String(Math.floor(ms / 1000)) };
      } catch (error) {
        return { input: line, iso: '', unix: '', error: (error as Error).message };
      }
    }),
  };
}
