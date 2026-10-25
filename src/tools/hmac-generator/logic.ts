import { hmac } from '@noble/hashes/hmac.js';
import { md5, sha1 } from '@noble/hashes/legacy.js';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export type HmacAlgorithm = 'sha256' | 'sha384' | 'sha512' | 'sha1' | 'md5';

const HASHES = {
  sha256,
  sha384,
  sha512,
  sha1,
  md5,
} as const;

export const HMAC_ALGORITHMS: ReadonlyArray<{ value: HmacAlgorithm; label: string; legacy?: string }> = [
  { value: 'sha256', label: 'HMAC-SHA-256' },
  { value: 'sha384', label: 'HMAC-SHA-384' },
  { value: 'sha512', label: 'HMAC-SHA-512' },
  { value: 'sha1', label: 'HMAC-SHA-1', legacy: 'SHA-1 collisions are practical. Use it only to check old MACs.' },
  { value: 'md5', label: 'HMAC-MD5', legacy: 'MD5 is broken for security. Use it only to check old MACs.' },
];

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set(['algo', 'key', 'key-hex']);
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

function algorithm(name: string): HmacAlgorithm {
  const id = name
    .trim()
    .toLowerCase()
    .replace(/^hmac-/, '');
  if (id in HASHES) return id as HmacAlgorithm;
  throw new ToolInputError('Choose sha256, sha384, sha512, sha1 or md5.');
}

/** HMAC over the message body. `key:` is UTF-8; `key-hex:` is raw key bytes. Default algorithm is SHA-256. */
export function hmacGenerator(input: string, fallback: HmacAlgorithm = 'sha256'): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const { headers, body } = headersAndBody(input);
  if (headers.key === undefined && headers['key-hex'] === undefined) {
    throw new ToolInputError('Add a key: line (UTF-8) or a key-hex: line.');
  }
  let key: Uint8Array;
  if (headers['key-hex'] !== undefined && headers['key-hex'] !== '') {
    const hex = headers['key-hex'].trim().replace(/\s+/g, '');
    if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex))
      throw new ToolInputError('key-hex must be an even number of hex digits.');
    key = hexToBytes(hex);
  } else {
    key = new TextEncoder().encode(headers.key ?? '');
  }
  const algo = algorithm(headers.algo ?? fallback);
  return `${algo} ${bytesToHex(hmac(HASHES[algo], key, new TextEncoder().encode(body)))}`;
}
