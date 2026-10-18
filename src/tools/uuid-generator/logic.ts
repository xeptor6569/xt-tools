import { ToolInputError } from '../types.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export type UuidVersion = 'v4' | 'v7' | 'nil' | 'max';

export interface UuidOptions {
  version: UuidVersion;
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

export const MAX_COUNT = 1000;

/** Parses the "how many" field. */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > MAX_COUNT) throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  return n;
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

function format(bytes: Uint8Array, { uppercase, hyphens, braces }: UuidOptions): string {
  const h = hex(bytes);
  let s = hyphens ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : h;
  if (uppercase) s = s.toUpperCase();
  return braces ? `{${s}}` : s;
}

/** RFC 9562 version 4: 122 random bits. */
export function uuidV4Bytes(random: RandomBytes): Uint8Array {
  const b = random(16).slice(0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return b;
}

/**
 * RFC 9562 version 7: 48-bit Unix milliseconds, then a 12-bit counter
 * (method 1, so UUIDs from one batch sort in creation order), then 62 random bits.
 */
export function uuidV7Bytes(ms: number, counter: number, random: RandomBytes): Uint8Array {
  const b = random(16).slice(0, 16);
  let t = Math.floor(ms);
  for (let i = 5; i >= 0; i--) {
    b[i] = t % 256;
    t = Math.floor(t / 256);
  }
  b[6] = 0x70 | ((counter >> 8) & 0x0f);
  b[7] = counter & 0xff;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return b;
}

export function uuidGenerator(count: number, options: UuidOptions, random: RandomBytes, now = Date.now()): string[] {
  if (options.version === 'nil') return Array.from({ length: count }, () => format(new Uint8Array(16), options));
  if (options.version === 'max')
    return Array.from({ length: count }, () => format(new Uint8Array(16).fill(0xff), options));
  if (options.version === 'v4') return Array.from({ length: count }, () => format(uuidV4Bytes(random), options));

  // v7: start the counter at a random value below 2048 to leave room to increment.
  let ms = now;
  let counter = ((random(2)[0] ?? 0) << 3) & 0x7ff;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    if (counter > 0xfff) {
      ms += 1;
      counter = 0;
    }
    out.push(format(uuidV7Bytes(ms, counter++, random), options));
  }
  return out;
}
