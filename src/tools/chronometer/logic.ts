import { ToolInputError } from '../types.ts';

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** `hh:mm:ss.mmm` for a duration in milliseconds. */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) throw new ToolInputError('Elapsed time must be zero or positive.');
  const total = Math.floor(ms);
  const hours = Math.floor(total / 3_600_000);
  if (hours > 999) throw new ToolInputError('Elapsed time is too long to show.');
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

/** Lap lines. Each entry is the total elapsed milliseconds at that lap. */
export function formatLaps(laps: readonly number[]): string {
  return laps
    .map((total, index) => {
      const previous = index === 0 ? 0 : laps[index - 1]!;
      if (total < previous) throw new ToolInputError('Laps must be in order.');
      return `Lap ${index + 1}: ${formatElapsed(total - previous)} (at ${formatElapsed(total)})`;
    })
    .join('\n');
}
