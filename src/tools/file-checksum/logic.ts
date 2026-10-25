import { blake3 } from '@noble/hashes/blake3.js';
import { md5, ripemd160, sha1 } from '@noble/hashes/legacy.js';
import { sha224, sha256, sha384, sha512, sha512_256 } from '@noble/hashes/sha2.js';
import { sha3_224, sha3_256, sha3_384, sha3_512 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { xxHash32 } from 'js-xxhash';
import { ToolInputError } from '../types.ts';
import { adler32, crc32, xxhash64 } from '../hash-text/checksums.ts';

const MAX_INPUT = 1_000_000;
const MAX_FILE = 64 * 1024 * 1024;

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

interface Algorithm {
  label: string;
  note?: string;
  fn: (b: Uint8Array) => Uint8Array;
}

const LEGACY = 'Legacy: collisions are practical; don’t use for security.';
const CHECKSUM = 'Checksum: not cryptographic.';

const ALGORITHMS: Algorithm[] = [
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

export const CHECKSUM_ALGORITHMS = ALGORITHMS.map(({ label, note }) => ({ label, ...(note ? { note } : {}) }));

const BY_LABEL = new Map(ALGORITHMS.map((a) => [a.label.toLowerCase(), a]));

export function normalizeAlgorithm(name: string): Algorithm {
  const found = BY_LABEL.get(name.trim().toLowerCase());
  if (!found) throw new ToolInputError(`Unknown algorithm "${name.trim()}".`);
  return found;
}

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set(['algo', 'expect']);
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

function normalizeHex(value: string): string {
  return value.trim().toLowerCase().replace(/[\s:]/g, '');
}

export function digestHex(bytes: Uint8Array, algorithm = 'SHA-256'): { label: string; hex: string; note?: string } {
  if (bytes.length > MAX_FILE) throw new ToolInputError('File is too large (maximum 64 MB).');
  const algo = normalizeAlgorithm(algorithm);
  const hex = bytesToHex(algo.fn(bytes));
  return { label: algo.label, hex, ...(algo.note ? { note: algo.note } : {}) };
}

function formatResult(label: string, hex: string, note: string | undefined, expected: string | undefined): string {
  const lines = [`${label} ${hex}`];
  if (note) lines.push(note);
  if (expected !== undefined && expected !== '') {
    lines.push(normalizeHex(expected) === hex ? 'match' : 'mismatch');
  }
  return lines.join('\n');
}

/** Hashes pasted text. Optional `algo:` and `expect:` headers select the algorithm and compare. */
export function fileChecksum(input: string, fallbackAlgorithm = 'SHA-256'): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const { headers, body } = headersAndBody(input);
  const hasHeader = Object.keys(headers).length > 0;
  const payload = hasHeader ? body : input;
  const { label, hex, note } = digestHex(new TextEncoder().encode(payload), headers.algo ?? fallbackAlgorithm);
  return formatResult(label, hex, note, headers.expect);
}

/** Hashes file bytes and, when `expected` is non-empty, reports match or mismatch. */
export function checksumBytes(bytes: Uint8Array, algorithm = 'SHA-256', expected = ''): string {
  const { label, hex, note } = digestHex(bytes, algorithm);
  return formatResult(label, hex, note, expected.trim() === '' ? undefined : expected);
}
