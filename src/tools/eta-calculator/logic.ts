import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;

const SECONDS: Record<string, number> = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  d: 86_400,
  day: 86_400,
  days: 86_400,
};

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;

function formatSeconds(seconds: number): string {
  const whole = Math.round(seconds);
  if (!Number.isFinite(whole)) throw new ToolInputError('Result is not a finite duration.');
  if (whole <= 0) return '0 seconds';
  const parts: string[] = [];
  let left = whole;
  const days = Math.floor(left / 86_400);
  if (days) {
    parts.push(`${days} day${days === 1 ? '' : 's'}`);
    left -= days * 86_400;
  }
  const hours = Math.floor(left / 3600);
  if (hours) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    left -= hours * 3600;
  }
  const mins = Math.floor(left / 60);
  if (mins) {
    parts.push(`${mins} min`);
    left -= mins * 60;
  }
  if (left || parts.length === 0) parts.push(`${left} second${left === 1 ? '' : 's'}`);
  const friendly = parts.join(' ');
  if (friendly === `${whole} second` || friendly === `${whole} seconds`) return friendly;
  return `${whole} seconds (${friendly})`;
}

function unitSeconds(name: string): number {
  const factor = SECONDS[name.toLowerCase()];
  if (factor === undefined) throw new ToolInputError(`Unknown time unit "${name}". Use seconds, min, hours or days.`);
  return factor;
}

function finish(fraction: number, elapsedSeconds: number): string {
  if (!Number.isFinite(fraction) || !Number.isFinite(elapsedSeconds)) {
    throw new ToolInputError('Enter finite numbers.');
  }
  if (elapsedSeconds < 0) throw new ToolInputError('Elapsed time cannot be negative.');
  if (fraction <= 0) throw new ToolInputError('Need some progress to estimate a finish time.');
  if (fraction > 1) throw new ToolInputError('Progress cannot be more than 100%.');
  const total = elapsedSeconds / fraction;
  const remaining = total - elapsedSeconds;
  const percent = Math.round(fraction * 1000) / 10;
  return [
    `Progress: ${percent}%`,
    `Elapsed: ${formatSeconds(elapsedSeconds)}`,
    `Remaining: ${formatSeconds(remaining)}`,
    `ETA: ${formatSeconds(remaining)}`,
  ].join('\n');
}

/**
 * Estimate remaining time from progress. The result is a duration, not a clock time.
 * Forms: "50% in 10 min" and "done 25 of 100 in 600 seconds".
 */
export function etaCalculator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const text = input.trim();
  if (text === '') return '';

  const percent = new RegExp(String.raw`^(${NUMBER})\s*%\s+in\s+(${NUMBER})\s*([A-Za-z]+)$`, 'i').exec(text);
  if (percent) {
    const pct = Number(percent[1]);
    const amount = Number(percent[2]);
    return finish(pct / 100, amount * unitSeconds(percent[3]!));
  }

  const done = new RegExp(
    String.raw`^(?:done\s+)?(${NUMBER})\s+of\s+(${NUMBER})\s+in\s+(${NUMBER})\s*([A-Za-z]+)$`,
    'i',
  ).exec(text);
  if (done) {
    const completed = Number(done[1]);
    const total = Number(done[2]);
    const amount = Number(done[3]);
    if (total <= 0) throw new ToolInputError('The total must be greater than zero.');
    if (completed < 0) throw new ToolInputError('Completed work cannot be negative.');
    if (completed > total) throw new ToolInputError('Completed work cannot be more than the total.');
    return finish(completed / total, amount * unitSeconds(done[4]!));
  }

  throw new ToolInputError('Use "50% in 10 min" or "done 25 of 100 in 600 seconds".');
}
