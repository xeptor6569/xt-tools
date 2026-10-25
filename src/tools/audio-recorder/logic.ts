import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export const AUDIO_MIMES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

/** Turns a clip name into a download filename. Blank becomes `audio.webm`. */
export function audioRecorder(input: string): string {
  return clipFileName(input, 'audio');
}

export function pickAudioMime(supported: (mime: string) => boolean): string {
  for (const mime of AUDIO_MIMES) {
    try {
      if (supported(mime)) return mime;
    } catch {
      // A browser that throws from isTypeSupported is treated as unsupported.
    }
  }
  return 'audio/webm';
}

export function extensionFor(mime: string): string {
  const base = mime.split(';')[0]?.toLowerCase() ?? '';
  if (base.endsWith('/mp4')) return 'mp4';
  if (base.endsWith('/ogg')) return 'ogg';
  return 'webm';
}

/**
 * Peak heights (0–100) from analyser time-domain samples. 128 is silence.
 * `bars` windows cover the buffer from left to right.
 */
export function waveformBars(samples: ArrayLike<number>, bars: number): number[] {
  if (!Number.isInteger(bars) || bars < 1 || bars > 512) {
    throw new ToolInputError('Ask for between 1 and 512 bars.');
  }
  const out: number[] = [];
  const total = samples.length;
  for (let i = 0; i < bars; i++) {
    if (total === 0) {
      out.push(0);
      continue;
    }
    const start = Math.floor((i * total) / bars);
    const end = Math.max(start + 1, Math.floor(((i + 1) * total) / bars));
    let peak = 0;
    for (let j = start; j < end && j < total; j++) {
      const sample = Math.abs((samples[j] ?? 128) - 128);
      if (sample > peak) peak = sample;
    }
    out.push(Math.round((peak / 128) * 100));
  }
  return out;
}

function clipFileName(input: string, fallback: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Name is too long.');
  const safe = input
    .trim()
    .slice(0, 80)
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const stem = safe === '' || safe === '.' || safe === '..' ? fallback : safe;
  return `${stem}.webm`;
}
