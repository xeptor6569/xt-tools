import { ToolInputError } from '../types.ts';

export const POMODORO_MINUTES = 25;

/** Minutes from the text field. Empty and malformed input throw ToolInputError. */
export function parseMinutes(text: string): number {
  if (text.length > 20) throw new ToolInputError('Enter a shorter number of minutes.');
  const trimmed = text.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) throw new ToolInputError('Enter a number of minutes.');
  const minutes = Number(trimmed);
  if (!Number.isFinite(minutes) || minutes <= 0) throw new ToolInputError('Minutes must be greater than zero.');
  if (minutes > 24 * 60) throw new ToolInputError('Enter at most 1440 minutes (24 hours).');
  return minutes;
}

/** Countdown clock. Hours appear only past 59:59. */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) throw new ToolInputError('Duration is not a finite number.');
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}
