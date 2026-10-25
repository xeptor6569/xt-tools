import { ToolInputError } from '../types.ts';

/** Beats per minute, from 20 to 300. */
export function parseBpm(text: string): number {
  if (text.length > 20) throw new ToolInputError('Enter a shorter tempo.');
  const trimmed = text.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) throw new ToolInputError('Enter a tempo in beats per minute.');
  const bpm = Number(trimmed);
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) {
    throw new ToolInputError('Enter a tempo from 20 to 300 BPM.');
  }
  return bpm;
}

export function beatIntervalMs(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new ToolInputError('Tempo must be greater than zero.');
  return 60_000 / bpm;
}
