import { bytesToHex } from '@noble/hashes/utils.js';
import { base64, base64urlnopad } from '@scure/base';
import { ToolInputError } from '../types.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export type TokenFormat = 'hex' | 'base64' | 'base64url' | 'binary';

export const MAX_COUNT = 1000;
export const MIN_BYTES = 1;
/** One mebibyte, matching a practical openssl rand upper bound in the browser. */
export const MAX_BYTES = 1_048_576;
export const DEFAULT_BYTES = 32;
/** crypto.getRandomValues refuses a view longer than this. */
const QUOTA = 65_536;

/** Parses the "how many" field. Blank means one value. */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > MAX_COUNT) throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  return n;
}

/** Parses the byte length. Blank means 32, the same default people pass to openssl rand. */
export function parseByteLength(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return DEFAULT_BYTES;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number of bytes.');
  const n = Number(trimmed);
  if (n < MIN_BYTES || n > MAX_BYTES) {
    throw new ToolInputError(`Enter a length from ${MIN_BYTES} to ${MAX_BYTES} bytes.`);
  }
  return n;
}

function assertBudget(count: number, byteLength: number): void {
  if (count * byteLength > MAX_BYTES) {
    throw new ToolInputError(`At most ${MAX_BYTES} bytes in total. Lower the count or the length.`);
  }
}

/** Reads exactly `n` bytes, in quota-sized chunks when `n` is large. */
export function readRandom(n: number, random: RandomBytes): Uint8Array {
  if (!Number.isInteger(n) || n < MIN_BYTES || n > MAX_BYTES) {
    throw new ToolInputError(`Enter a length from ${MIN_BYTES} to ${MAX_BYTES} bytes.`);
  }
  const out = new Uint8Array(n);
  let off = 0;
  while (off < n) {
    const take = Math.min(QUOTA, n - off);
    const chunk = random(take);
    if (!(chunk instanceof Uint8Array) || chunk.length !== take) {
      throw new ToolInputError('Random source returned the wrong number of bytes.');
    }
    out.set(chunk, off);
    off += take;
  }
  return out;
}

/** `count` blocks of `byteLength` bytes, concatenated. */
export function randomBytes(byteLength: number, count: number, random: RandomBytes): Uint8Array {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  }
  assertBudget(count, byteLength);
  const out = new Uint8Array(count * byteLength);
  for (let i = 0; i < count; i++) out.set(readRandom(byteLength, random), i * byteLength);
  return out;
}

/** Wraps base64 the way `openssl rand -base64` does, at 64 columns, without a trailing blank line. */
export function wrap64(text: string): string {
  if (text.length <= 64) return text;
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += 64) lines.push(text.slice(i, i + 64));
  return lines.join('\n');
}

/** Encodes one block. Binary is not text; the caller downloads those bytes instead. */
export function encodeRandom(bytes: Uint8Array, format: Exclude<TokenFormat, 'binary'>): string {
  if (format === 'base64') return wrap64(base64.encode(bytes));
  if (format === 'base64url') return base64urlnopad.encode(bytes);
  return bytesToHex(bytes);
}

/**
 * Generates `count` encoded values. Randomness comes only from `random`.
 * Each value is `byteLength` bytes, like one `openssl rand` invocation.
 */
export function tokenGenerator(
  count: number,
  random: RandomBytes,
  byteLength = DEFAULT_BYTES,
  format: Exclude<TokenFormat, 'binary'> = 'hex',
): string[] {
  const block = randomBytes(byteLength, count, random);
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(encodeRandom(block.subarray(i * byteLength, (i + 1) * byteLength), format));
  }
  return lines;
}

/** The openssl rand command that produces the same shape of output. */
export function opensslCommand(byteLength: number, format: TokenFormat): string {
  if (!Number.isInteger(byteLength) || byteLength < MIN_BYTES) return '';
  if (format === 'hex') return `openssl rand -hex ${byteLength}`;
  if (format === 'base64' || format === 'base64url') return `openssl rand -base64 ${byteLength}`;
  return `openssl rand -out random.bin ${byteLength}`;
}
