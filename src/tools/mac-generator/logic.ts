import { ToolInputError } from '../types.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export const MAX_COUNT = 1000;

export interface MacOptions {
  /** Set the U/L bit. Default true. */
  local?: boolean;
  /** Clear the I/G bit. Default true. */
  unicast?: boolean;
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

/** Random MAC addresses. Unicast and locally administered unless the options say otherwise. */
export function macGenerator(count: number, random: RandomBytes, options: MacOptions = {}): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  }
  const local = options.local ?? true;
  const unicast = options.unicast ?? true;
  const addresses: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = random(6);
    if (!(bytes instanceof Uint8Array) || bytes.length !== 6) {
      throw new ToolInputError('Expected 6 random bytes for a MAC address.');
    }
    const out = new Uint8Array(bytes);
    let first = out[0] ?? 0;
    first = unicast ? first & 0xfe : first | 0x01;
    first = local ? first | 0x02 : first & 0xfd;
    out[0] = first;
    addresses.push([...out].map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(':'));
  }
  return addresses;
}
