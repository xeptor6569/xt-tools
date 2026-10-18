import { Cron } from 'croner';
import cronstrue from 'cronstrue';
import { ToolInputError } from '../types.ts';

export type Zone = 'local' | 'UTC';

export interface CronField {
  name: string;
  value: string;
  allowed: string;
}

export interface CronResult {
  description: string;
  nextRuns: Date[];
  fields: CronField[];
}

const MAX_INPUT = 200;

const FIELDS_5: Array<[string, string]> = [
  ['Minute', '0–59'],
  ['Hour', '0–23'],
  ['Day of month', '1–31'],
  ['Month', '1–12 or JAN–DEC'],
  ['Day of week', '0–7 or SUN–SAT (0 and 7 are Sunday)'],
];
const SECONDS: [string, string] = ['Second', '0–59'];

const NICKNAMES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export const PRESETS: ReadonlyArray<{ label: string; expression: string }> = [
  { label: 'Every minute', expression: '* * * * *' },
  { label: 'Every 15 minutes', expression: '*/15 * * * *' },
  { label: 'Hourly', expression: '0 * * * *' },
  { label: 'Daily at midnight', expression: '0 0 * * *' },
  { label: 'Weekdays at 9:00', expression: '0 9 * * 1-5' },
  { label: 'Sundays at 3:30', expression: '30 3 * * 0' },
  { label: 'First of the month', expression: '0 0 1 * *' },
];

/** Explains a cron expression and lists its next runs after `now`. */
export function crontab(
  input: string,
  { now = new Date(), count = 10, zone = 'local' as Zone } = {},
): CronResult | undefined {
  if (input.length > MAX_INPUT) throw new ToolInputError('Expression is too long.');
  const raw = input.trim().replace(/\s+/g, ' ');
  if (raw === '') return undefined;
  const expression = NICKNAMES[raw.toLowerCase()] ?? raw;
  const parts = expression.split(' ');
  if (parts.length < 5 || parts.length > 6) {
    throw new ToolInputError(
      'A cron expression has 5 fields (minute hour day month weekday), or 6 with seconds first.',
    );
  }

  let job: Cron;
  try {
    job = new Cron(expression, { paused: true, ...(zone === 'UTC' ? { timezone: 'UTC' } : {}) });
  } catch (error) {
    throw new ToolInputError(`Invalid cron expression: ${(error as Error).message.replace(/^CronPattern: /, '')}.`);
  }

  let description: string;
  try {
    description = cronstrue.toString(expression, { use24HourTimeFormat: true, verbose: true });
  } catch (error) {
    throw new ToolInputError(`Invalid cron expression: ${String(error).replace(/^Error: /, '')}.`);
  }

  const names = parts.length === 6 ? [SECONDS, ...FIELDS_5] : FIELDS_5;
  return {
    description: zone === 'UTC' ? `${description} (UTC)` : description,
    nextRuns: job.nextRuns(count, now),
    fields: names.map(([name, allowed], i) => ({ name, value: parts[i] ?? '', allowed })),
  };
}
