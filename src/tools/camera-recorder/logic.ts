import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export const VIDEO_MIMES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
] as const;

/** Turns a clip name into a download filename. Blank becomes `camera.webm`. */
export function cameraRecorder(input: string): string {
  return clipFileName(input, 'camera');
}

export function pickVideoMime(supported: (mime: string) => boolean): string {
  for (const mime of VIDEO_MIMES) {
    try {
      if (supported(mime)) return mime;
    } catch {
      // A browser that throws from isTypeSupported is treated as unsupported.
    }
  }
  return 'video/webm';
}

export function extensionFor(mime: string): string {
  const base = mime.split(';')[0]?.toLowerCase() ?? '';
  if (base.endsWith('/mp4')) return 'mp4';
  if (base.endsWith('/ogg')) return 'ogg';
  return 'webm';
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
