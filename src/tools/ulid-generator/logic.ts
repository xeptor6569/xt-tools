import { ToolInputError } from '../types.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export const MAX_COUNT = 1000;
/** Crockford base32: no I, L, O or U. */
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_MAX = 0xffffffffffff;

/** Parses the "how many" field. */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > MAX_COUNT) throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  return n;
}

/** 48-bit millisecond timestamp as 10 Crockford characters. */
export function encodeUlidTime(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0 || ms > TIME_MAX)
    throw new ToolInputError('Timestamp is out of range for a ULID.');
  const chars = Array<string>(10);
  let n = ms;
  for (let i = 9; i >= 0; i--) {
    chars[i] = CROCKFORD[n % 32]!;
    n = Math.floor(n / 32);
  }
  return chars.join('');
}

/** 80 bits (10 bytes) as 16 Crockford characters, most significant bits first. */
export function encodeUlidRandom(bytes: Uint8Array): string {
  if (bytes.length !== 10) throw new ToolInputError('A ULID needs 10 random bytes.');
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  const chars = Array<string>(16);
  for (let i = 15; i >= 0; i--) {
    chars[i] = CROCKFORD[Number(n & 31n)]!;
    n >>= 5n;
  }
  return chars.join('');
}

/**
 * ULID: 48-bit Unix time in milliseconds, then 80 bits of randomness.
 * `now` is injectable so tests can pin the timestamp.
 */
export function ulidGenerator(count: number, random: RandomBytes, now = Date.now()): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  }
  const time = encodeUlidTime(Math.floor(now));
  return Array.from({ length: count }, () => time + encodeUlidRandom(random(10)));
}
