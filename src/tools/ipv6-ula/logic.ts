import { formatIpv6 } from '../../lib/ipv6.ts';
import { ToolInputError } from '../types.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

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

/**
 * RFC 4193 locally assigned ULA prefixes: fd00::/8 plus 40 random bits,
 * written as a /48 in RFC 5952 form.
 */
export function ipv6Ula(count: number, random: RandomBytes): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  }
  const prefixes: string[] = [];
  for (let i = 0; i < count; i++) {
    const rnd = random(5);
    if (!(rnd instanceof Uint8Array) || rnd.length !== 5) {
      throw new ToolInputError('Expected 5 random bytes for the ULA global ID.');
    }
    const addr = new Uint8Array(16);
    addr[0] = 0xfd;
    addr.set(rnd, 1);
    prefixes.push(`${formatIpv6(addr)}/48`);
  }
  return prefixes;
}
