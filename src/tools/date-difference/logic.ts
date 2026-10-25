import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;
const DAY_MS = 86_400_000;
const MAX_DAYS = 366 * 10_000;

function parseDate(token: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token);
  if (!match) throw new ToolInputError(`"${token}" is not a date. Use YYYY-MM-DD.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ToolInputError(`"${token}" is not a real calendar date.`);
  }
  return date;
}

/**
 * Business days in the half-open span [start, end): the start date counts,
 * the end date does not. Weekends are Saturday and Sunday. No holiday calendar.
 */
export function businessDays(start: Date, end: Date): number {
  if (end.getTime() <= start.getTime()) return 0;
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const fullWeeks = Math.floor(days / 7);
  let count = fullWeeks * 5;
  const startDow = start.getUTCDay();
  const rest = days % 7;
  for (let i = 0; i < rest; i++) {
    const dow = (startDow + i) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/** Calendar days and Mon–Fri business days between two dates. */
export function dateDifference(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const text = input.trim();
  if (text === '') return '';
  const parts = text.split(/[\s,]+/).filter((part) => part !== '');
  if (parts.length !== 2) throw new ToolInputError('Enter two dates, such as 2026-01-01 2026-01-31.');
  const a = parseDate(parts[0]!);
  const b = parseDate(parts[1]!);
  const [earlier, later] = a.getTime() <= b.getTime() ? [a, b] : [b, a];
  const days = Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
  if (days > MAX_DAYS) throw new ToolInputError('That span is too long.');
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return [
    `Earlier: ${iso(earlier)}`,
    `Later: ${iso(later)}`,
    `Calendar days: ${days}`,
    `Business days (Mon–Fri): ${businessDays(earlier, later)}`,
  ].join('\n');
}
