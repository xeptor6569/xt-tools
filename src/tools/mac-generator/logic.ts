import { ToolInputError } from '../types.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export const MAX_COUNT = 1000;

export type MacCase = 'upper' | 'lower';

export interface MacOptions {
  /** Set the U/L bit. Default true. Ignored when `prefix` includes the first byte. */
  local?: boolean;
  /** Clear the I/G bit. Default true. Ignored when `prefix` includes the first byte. */
  unicast?: boolean;
  /** Leading hex bytes, such as `AA:BB:CC`. At most 5 bytes. */
  prefix?: string;
  /** Hex letter case. Default upper, which is what this tool printed before. */
  letterCase?: MacCase;
}

/** Parses the "how many" field. */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > MAX_COUNT) throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  return n;
}

/** Hex bytes from a MAC prefix. Empty text means no prefix. */
export function parseMacPrefix(text: string): Uint8Array {
  const trimmed = text.trim();
  if (trimmed === '') return new Uint8Array();
  const hex = trimmed.replace(/[:\-.\s]/g, '');
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new ToolInputError('The prefix must be hex bytes, such as AA:BB:CC.');
  }
  if (hex.length > 10) {
    throw new ToolInputError('The prefix can be at most 5 bytes. The rest of the address is random.');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Random MAC addresses. Unicast and locally administered unless the options say otherwise. */
export function macGenerator(count: number, random: RandomBytes, options: MacOptions = {}): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  }
  const prefix = parseMacPrefix(options.prefix ?? '');
  const letterCase = options.letterCase ?? 'upper';
  const local = options.local ?? true;
  const unicast = options.unicast ?? true;
  const addresses: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = random(6);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 6) {
      throw new ToolInputError('Expected 6 random bytes for a MAC address.');
    }
    const out = new Uint8Array(bytes);
    if (prefix.length === 0) {
      let first = out[0] ?? 0;
      first = unicast ? first & 0xfe : first | 0x01;
      first = local ? first | 0x02 : first & 0xfd;
      out[0] = first;
    } else {
      out.set(prefix);
    }
    const hex = [...out].map((byte) => byte.toString(16).padStart(2, '0'));
    addresses.push((letterCase === 'lower' ? hex : hex.map((part) => part.toUpperCase())).join(':'));
  }
  return addresses;
}
