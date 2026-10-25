import { bytesToHex } from '@noble/hashes/utils.js';
import { base64, base64urlnopad } from '@scure/base';
import { ToolInputError } from '../types.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export type TokenFormat = 'hex' | 'base64' | 'base64url';

export const MAX_COUNT = 1000;
export const MIN_BYTES = 8;
export const MAX_BYTES = 512;
export const DEFAULT_BYTES = 32;

/** Parses the "how many" field. */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > MAX_COUNT) throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  return n;
}

/** Parses the "bytes each" field. */
export function parseByteLength(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return DEFAULT_BYTES;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number of bytes.');
  const n = Number(trimmed);
  if (n < MIN_BYTES || n > MAX_BYTES)
    throw new ToolInputError(`Enter a length from ${MIN_BYTES} to ${MAX_BYTES} bytes.`);
  return n;
}

function encode(bytes: Uint8Array, format: TokenFormat): string {
  if (format === 'base64') return base64.encode(bytes);
  if (format === 'base64url') return base64urlnopad.encode(bytes);
  return bytesToHex(bytes);
}

/** Generates `count` tokens. Randomness comes only from `random`. */
export function tokenGenerator(
  count: number,
  random: RandomBytes,
  byteLength = DEFAULT_BYTES,
  format: TokenFormat = 'hex',
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  }
  if (!Number.isInteger(byteLength) || byteLength < MIN_BYTES || byteLength > MAX_BYTES) {
    throw new ToolInputError(`Enter a length from ${MIN_BYTES} to ${MAX_BYTES} bytes.`);
  }
  return Array.from({ length: count }, () => {
    const bytes = random(byteLength);
    if (bytes.length !== byteLength) throw new ToolInputError('Random source returned the wrong number of bytes.');
    return encode(bytes, format);
  });
}
