import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

/** GF(256) with the AES polynomial. 2 is not primitive in this field, so multiply directly. */
function mul(a: number, b: number): number {
  let p = 0;
  let n = a;
  let m = b;
  for (let i = 0; i < 8; i++) {
    if (m & 1) p ^= n;
    const hi = n & 0x80;
    n = (n << 1) & 0xff;
    if (hi) n ^= 0x1b;
    m >>= 1;
  }
  return p;
}

const INV = new Uint8Array(256);
for (let a = 1; a < 256; a++) {
  let p = 1;
  let base = a;
  // a^254 = a^-1
  let exp = 254;
  while (exp > 0) {
    if (exp & 1) p = mul(p, base);
    base = mul(base, base);
    exp >>= 1;
  }
  INV[a] = p;
}

function div(a: number, b: number): number {
  if (b === 0) throw new ToolInputError('Share data is corrupt.');
  return mul(a, INV[b]!);
}

export type RandomBytes = (n: number) => Uint8Array;

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set(['mode', 'threshold', 'shares']);
  const lines = input.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const match = /^([a-z][a-z0-9-]*)\s*:\s*(.*)$/i.exec(lines[i] ?? '');
    if (!match || !known.has(match[1]!.toLowerCase())) break;
    headers[match[1]!.toLowerCase()] = match[2] ?? '';
    i++;
  }
  if (i > 0 && (lines[i] ?? '') === '') i++;
  return { headers, body: lines.slice(i).join('\n') };
}

function positive(value: string | undefined, fallback: number, label: string, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  if (!/^\d+$/.test(value.trim())) throw new ToolInputError(`${label} must be a whole number.`);
  const n = Number(value.trim());
  if (n < 1 || n > max) throw new ToolInputError(`${label} must be from 1 to ${max}.`);
  return n;
}

interface Share {
  x: number;
  y: Uint8Array;
}

function parseShares(body: string): Share[] {
  const shares: Share[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const match = /^(\d+)\s*:\s*([0-9a-f]+)$/i.exec(trimmed);
    if (!match) throw new ToolInputError('Each share is a line like "1: hex".');
    const x = Number(match[1]);
    if (x < 1 || x > 255) throw new ToolInputError('Share numbers must be from 1 to 255.');
    const hex = match[2]!;
    if (hex.length % 2 !== 0) throw new ToolInputError('Share hex must have an even length.');
    shares.push({ x, y: hexToBytes(hex) });
  }
  if (shares.length < 2) throw new ToolInputError('Join needs at least two shares.');
  const width = shares[0]!.y.length;
  if (shares.some((s) => s.y.length !== width)) throw new ToolInputError('Shares must be the same length.');
  if (new Set(shares.map((s) => s.x)).size !== shares.length) throw new ToolInputError('Share numbers must be unique.');
  return shares;
}

/** p(0) by Lagrange interpolation in GF(256). Subtraction is XOR. */
function interpolate(shares: Share[]): Uint8Array {
  const out = new Uint8Array(shares[0]!.y.length);
  for (let byte = 0; byte < out.length; byte++) {
    let secret = 0;
    for (let i = 0; i < shares.length; i++) {
      let num = 1;
      let den = 1;
      const xi = shares[i]!.x;
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue;
        const xj = shares[j]!.x;
        num = mul(num, xj);
        den = mul(den, xi ^ xj);
      }
      secret ^= mul(shares[i]!.y[byte]!, div(num, den));
    }
    out[byte] = secret;
  }
  return out;
}

function split(secret: Uint8Array, threshold: number, count: number, random: RandomBytes): string {
  if (threshold > count) throw new ToolInputError('Threshold cannot be larger than the number of shares.');
  if (secret.length === 0) throw new ToolInputError('The secret is empty.');
  const coeffBytes = secret.length * (threshold - 1);
  const randomBytes = coeffBytes === 0 ? new Uint8Array() : random(coeffBytes);
  if (randomBytes.length !== coeffBytes) throw new ToolInputError('Random source returned the wrong number of bytes.');
  const lines: string[] = [];
  for (let x = 1; x <= count; x++) {
    const y = new Uint8Array(secret.length);
    for (let b = 0; b < secret.length; b++) {
      // p(z) = a0 + a1 z + a2 z^2 + ... with a0 = secret byte.
      let value = secret[b]!;
      let z = x;
      for (let c = 0; c < threshold - 1; c++) {
        value ^= mul(randomBytes[b * (threshold - 1) + c]!, z);
        z = mul(z, x);
      }
      y[b] = value;
    }
    lines.push(`${x}: ${bytesToHex(y)}`);
  }
  return lines.join('\n');
}

/**
 * Splits or joins a secret over GF(256).
 * Defaults, documented in the box: threshold 2, 3 shares.
 * Split is deterministic when `random` is fixed. Join does not use it.
 */
export function shamir(input: string, random?: RandomBytes): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const { headers, body } = headersAndBody(input);
  const mode = (headers.mode ?? (body.trim().includes(':') && /^ *\d+\s*:/m.test(body) ? 'join' : 'split'))
    .trim()
    .toLowerCase();
  if (mode === 'join') {
    const bytes = interpolate(parseShares(body));
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return `hex: ${bytesToHex(bytes)}`;
    }
  }
  if (mode !== 'split') throw new ToolInputError('mode must be split or join.');
  const threshold = positive(headers.threshold, 2, 'Threshold', 255);
  const count = positive(headers.shares, 3, 'Shares', 255);
  const secret = new TextEncoder().encode(body);
  if (!random) throw new ToolInputError('A random source is required to split.');
  return split(secret, threshold, count, random);
}
