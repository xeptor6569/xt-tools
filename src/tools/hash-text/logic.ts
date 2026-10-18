import { blake3 } from '@noble/hashes/blake3.js';
import { md5, ripemd160, sha1 } from '@noble/hashes/legacy.js';
import { sha224, sha256, sha384, sha512, sha512_256 } from '@noble/hashes/sha2.js';
import { sha3_224, sha3_256, sha3_384, sha3_512 } from '@noble/hashes/sha3.js';
import { xxHash32 } from 'js-xxhash';
import { ToolInputError } from '../types.ts';
import { adler32, crc32, xxhash64 } from './checksums.ts';

export type OutputFormat = 'hex' | 'HEX' | 'base64';

export interface HashResult {
  label: string;
  value: string;
  note?: string;
}

const MAX_INPUT = 10_000_000;
const LEGACY = 'Legacy: collisions are practical; don’t use for security.';
const CHECKSUM = 'Checksum: not cryptographic.';

const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0);
  return b;
};
const u64 = (n: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n);
  return b;
};

const ALGORITHMS: Array<{ label: string; note?: string; fn: (b: Uint8Array) => Uint8Array }> = [
  { label: 'SHA-256', fn: sha256 },
  { label: 'SHA-512', fn: sha512 },
  { label: 'SHA-384', fn: sha384 },
  { label: 'SHA-224', fn: sha224 },
  { label: 'SHA-512/256', fn: sha512_256 },
  { label: 'SHA3-256', fn: sha3_256 },
  { label: 'SHA3-512', fn: sha3_512 },
  { label: 'SHA3-384', fn: sha3_384 },
  { label: 'SHA3-224', fn: sha3_224 },
  { label: 'BLAKE3', fn: (b) => blake3(b) },
  { label: 'RIPEMD-160', fn: ripemd160 },
  { label: 'SHA-1', note: LEGACY, fn: sha1 },
  { label: 'MD5', note: LEGACY, fn: md5 },
  { label: 'CRC32', note: CHECKSUM, fn: (b) => u32(crc32(b)) },
  { label: 'Adler-32', note: CHECKSUM, fn: (b) => u32(adler32(b)) },
  { label: 'xxHash32', note: CHECKSUM, fn: (b) => u32(xxHash32(b, 0)) },
  { label: 'xxHash64', note: CHECKSUM, fn: (b) => u64(xxhash64(b)) },
];

export const ALGORITHM_LABELS = ALGORITHMS.map((a) => a.label);

function encode(bytes: Uint8Array, format: OutputFormat): string {
  if (format === 'base64') {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return format === 'HEX' ? hex.toUpperCase() : hex;
}

/** Hashes the UTF-8 bytes of `input` with every supported algorithm. */
export function hashText(input: string, format: OutputFormat = 'hex'): HashResult[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 10 MB).');
  const bytes = new TextEncoder().encode(input);
  return ALGORITHMS.map(({ label, note, fn }) => ({
    label,
    value: encode(fn(bytes), format),
    ...(note ? { note } : {}),
  }));
}
