import { ToolInputError } from '../types.ts';

const MAX_INPUT = 2_000;
const MAX_ZONES = 40;

export const DEFAULT_ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

function formatZone(zone: string, now: Date): string {
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(now);
    return `${zone}  ${formatted}`;
  } catch {
    throw new ToolInputError(`Unknown time zone "${zone}". Use an IANA name such as Europe/Paris.`);
  }
}

/** One clock per IANA zone. An empty input uses UTC, New York, London and Tokyo. */
export function worldClock(input: string, now: Date = new Date()): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const trimmed = input.trim();
  const zones = trimmed === '' ? DEFAULT_ZONES : trimmed.split(/[\s,]+/).filter((zone) => zone !== '');
  if (zones.length === 0) throw new ToolInputError('Enter at least one time zone.');
  if (zones.length > MAX_ZONES) throw new ToolInputError(`Enter at most ${MAX_ZONES} time zones.`);
  return zones.map((zone) => formatZone(zone, now)).join('\n');
}
