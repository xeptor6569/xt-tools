import { base64nopad, hex } from '@scure/base';
import { argon2d, argon2i, argon2id, argon2Verify, createSHA256, createSHA512, pbkdf2, scrypt } from 'hash-wasm';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export type PasswordHashAlgo = 'argon2id' | 'argon2i' | 'argon2d' | 'scrypt' | 'pbkdf2-sha256' | 'pbkdf2-sha512';

export interface PasswordHashOptions {
  algo?: PasswordHashAlgo;
  saltBytes?: Uint8Array;
  /** Argon2 memory in KiB (8 to 262144). */
  memory?: number;
  /** Argon2 time cost (1 to 32) or PBKDF2 iterations (100 to 2,000,000). */
  iterations?: number;
  /** Argon2 or scrypt parallelism (1 to 16). */
  parallelism?: number;
  /** scrypt N cost factor, power of two (2 to 65536). */
  cost?: number;
  /** scrypt block size r (1 to 32). */
  blockSize?: number;
  /** Output key length in bytes (16 to 64). */
  hashLength?: number;
}

export const PASSWORD_HASH_ALGOS: ReadonlyArray<{ value: PasswordHashAlgo; label: string }> = [
  { value: 'argon2id', label: 'Argon2id (recommended)' },
  { value: 'argon2i', label: 'Argon2i' },
  { value: 'argon2d', label: 'Argon2d' },
  { value: 'scrypt', label: 'scrypt' },
  { value: 'pbkdf2-sha256', label: 'PBKDF2-HMAC-SHA-256' },
  { value: 'pbkdf2-sha512', label: 'PBKDF2-HMAC-SHA-512' },
];

const KNOWN_HEADERS = new Set([
  'mode',
  'algo',
  'algorithm',
  'salt',
  'salt-hex',
  'memory',
  'm',
  'iterations',
  't',
  'parallelism',
  'p',
  'cost',
  'n',
  'r',
  'block-size',
  'length',
  'hash',
  'password',
]);

function parseHeaders(input: string): { headers: Record<string, string>; body: string } {
  const lines = input.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const match = /^([a-z][a-z0-9-]*)\s*:\s*(.*)$/i.exec(lines[i] ?? '');
    if (!match || !KNOWN_HEADERS.has(match[1]!.toLowerCase())) break;
    headers[match[1]!.toLowerCase()] = (match[2] ?? '').trim();
    i++;
  }
  if (i > 0 && (lines[i] ?? '') === '') i++;
  return { headers, body: lines.slice(i).join('\n') };
}

function intInRange(
  raw: string | number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string,
): number {
  if (raw === undefined || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ToolInputError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return n;
}

function resolveSalt(headers: Record<string, string>, fallback?: Uint8Array): Uint8Array {
  if (headers['salt-hex'] !== undefined) {
    const clean = headers['salt-hex'].replace(/\s+/g, '');
    if (clean.length < 16 || clean.length > 128 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
      throw new ToolInputError('salt-hex must be 8 to 64 bytes of even-length hexadecimal.');
    }
    return hex.decode(clean);
  }
  if (headers.salt !== undefined) {
    const bytes = new TextEncoder().encode(headers.salt);
    if (bytes.length < 8 || bytes.length > 64) {
      throw new ToolInputError('salt must be 8 to 64 UTF-8 bytes.');
    }
    return bytes;
  }
  if (fallback) {
    if (fallback.length < 8 || fallback.length > 64) {
      throw new ToolInputError('Salt must be 8 to 64 bytes.');
    }
    return fallback;
  }
  throw new ToolInputError(
    'A salt is required. The page generates one; tests pass saltBytes or a salt:/salt-hex: line.',
  );
}

function normalizeAlgo(raw: string | undefined, fallback: PasswordHashAlgo): PasswordHashAlgo {
  if (!raw) return fallback;
  const v = raw.toLowerCase();
  if (v === 'argon2' || v === 'argon2id') return 'argon2id';
  if (v === 'argon2i') return 'argon2i';
  if (v === 'argon2d') return 'argon2d';
  if (v === 'scrypt') return 'scrypt';
  if (v === 'pbkdf2' || v === 'pbkdf2-sha256') return 'pbkdf2-sha256';
  if (v === 'pbkdf2-sha512') return 'pbkdf2-sha512';
  throw new ToolInputError(
    `Unknown algorithm "${raw}". Choose argon2id, argon2i, argon2d, scrypt, pbkdf2-sha256 or pbkdf2-sha512.`,
  );
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function verifyPhc(password: string, phc: string): Promise<boolean> {
  const trimmed = phc.trim();
  if (/^\$argon2(id|i|d)\$/.test(trimmed)) {
    try {
      return await argon2Verify({ password, hash: trimmed });
    } catch {
      throw new ToolInputError('That is not a valid Argon2 PHC string.');
    }
  }
  const scryptMatch = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(trimmed);
  if (scryptMatch) {
    const ln = Number(scryptMatch[1]);
    const r = Number(scryptMatch[2]);
    const p = Number(scryptMatch[3]);
    if (ln < 1 || ln > 16 || r < 1 || r > 32 || p < 1 || p > 16) {
      throw new ToolInputError('scrypt parameters in the hash are out of range.');
    }
    let salt: Uint8Array;
    let expected: Uint8Array;
    try {
      salt = base64nopad.decode(scryptMatch[4]!);
      expected = base64nopad.decode(scryptMatch[5]!);
    } catch {
      throw new ToolInputError('That scrypt hash has invalid Base64.');
    }
    const derived = await scrypt({
      password,
      salt,
      costFactor: 1 << ln,
      blockSize: r,
      parallelism: p,
      hashLength: expected.length,
      outputType: 'binary',
    });
    return constantTimeEqual(derived, expected);
  }
  const pbkdf2Match = /^\$pbkdf2-(sha256|sha512)\$i=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(trimmed);
  if (pbkdf2Match) {
    const variant = pbkdf2Match[1]!;
    const iterations = Number(pbkdf2Match[2]);
    if (iterations < 1 || iterations > 2_000_000) {
      throw new ToolInputError('PBKDF2 iterations in the hash are out of range.');
    }
    let salt: Uint8Array;
    let expected: Uint8Array;
    try {
      salt = base64nopad.decode(pbkdf2Match[3]!);
      expected = base64nopad.decode(pbkdf2Match[4]!);
    } catch {
      throw new ToolInputError('That PBKDF2 hash has invalid Base64.');
    }
    const derived = await pbkdf2({
      password,
      salt,
      iterations,
      hashLength: expected.length,
      hashFunction: variant === 'sha512' ? createSHA512() : createSHA256(),
      outputType: 'binary',
    });
    return constantTimeEqual(derived, expected);
  }
  throw new ToolInputError(
    'Paste a PHC hash starting with $argon2id$, $argon2i$, $argon2d$, $scrypt$, $pbkdf2-sha256$ or $pbkdf2-sha512$.',
  );
}

/**
 * Hashes or verifies a password with Argon2id, Argon2i, Argon2d, scrypt or PBKDF2.
 * Runs in a Web Worker via hash-wasm.
 */
export async function passwordHash(input: string, options: PasswordHashOptions = {}): Promise<string> {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 100 KB).');
  if (input.trim() === '') return '';

  const { headers, body } = parseHeaders(input);
  const bare = Object.keys(headers).length === 0;
  const mode = (headers.mode ?? (headers.hash ? 'verify' : 'hash')).toLowerCase();
  const password = headers.password !== undefined ? headers.password : bare ? input : body;

  if (mode === 'verify' || mode === 'compare') {
    const hash = headers.hash ?? body.trim();
    if (!hash) throw new ToolInputError('Provide a hash: line to verify against.');
    const ok = await verifyPhc(password, hash);
    return ok ? 'match' : 'mismatch';
  }
  if (mode !== 'hash') {
    throw new ToolInputError('mode must be hash or verify.');
  }

  const algo = normalizeAlgo(headers.algo ?? headers.algorithm, options.algo ?? 'argon2id');
  const salt = resolveSalt(headers, options.saltBytes);
  const hashLength = intInRange(headers.length, options.hashLength ?? 32, 16, 64, 'Hash length');

  if (algo === 'argon2id' || algo === 'argon2i' || algo === 'argon2d') {
    const memorySize = intInRange(headers.memory ?? headers.m, options.memory ?? 19456, 8, 262144, 'Memory (KiB)');
    const iterations = intInRange(headers.iterations ?? headers.t, options.iterations ?? 2, 1, 32, 'Iterations');
    const parallelism = intInRange(headers.parallelism ?? headers.p, options.parallelism ?? 1, 1, 16, 'Parallelism');
    const fn = algo === 'argon2id' ? argon2id : algo === 'argon2i' ? argon2i : argon2d;
    const encoded = await fn({
      password,
      salt,
      memorySize,
      iterations,
      parallelism,
      hashLength,
      outputType: 'encoded',
    });
    const raw = await fn({
      password,
      salt,
      memorySize,
      iterations,
      parallelism,
      hashLength,
      outputType: 'hex',
    });
    return `${encoded}\nhex: ${raw}`;
  }

  if (algo === 'scrypt') {
    const costFactor = intInRange(headers.cost ?? headers.n, options.cost ?? 16384, 2, 65536, 'scrypt N');
    if ((costFactor & (costFactor - 1)) !== 0) {
      throw new ToolInputError('scrypt N must be a power of two (such as 1024, 16384 or 32768).');
    }
    const blockSize = intInRange(headers.r ?? headers['block-size'], options.blockSize ?? 8, 1, 32, 'scrypt r');
    const parallelism = intInRange(headers.parallelism ?? headers.p, options.parallelism ?? 1, 1, 16, 'scrypt p');
    if (128 * costFactor * blockSize > 256 * 1024 * 1024) {
      throw new ToolInputError('scrypt memory (128 * N * r) exceeds 256 MB.');
    }
    const derived = await scrypt({
      password,
      salt,
      costFactor,
      blockSize,
      parallelism,
      hashLength,
      outputType: 'binary',
    });
    const ln = Math.round(Math.log2(costFactor));
    const phc = `$scrypt$ln=${ln},r=${blockSize},p=${parallelism}$${base64nopad.encode(salt)}$${base64nopad.encode(derived)}`;
    return `${phc}\nhex: ${hex.encode(derived)}`;
  }

  const iterations = intInRange(
    headers.iterations ?? headers.t,
    options.iterations ?? 100_000,
    1,
    2_000_000,
    'PBKDF2 iterations',
  );
  const derived = await pbkdf2({
    password,
    salt,
    iterations,
    hashLength,
    hashFunction: algo === 'pbkdf2-sha512' ? createSHA512() : createSHA256(),
    outputType: 'binary',
  });
  const phc = `$${algo}$i=${iterations}$${base64nopad.encode(salt)}$${base64nopad.encode(derived)}`;
  return `${phc}\nhex: ${hex.encode(derived)}`;
}
