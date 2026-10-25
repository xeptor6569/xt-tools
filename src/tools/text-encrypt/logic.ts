import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { base64, base64nopad } from '@scure/base';
import { ToolInputError } from '../types.ts';
import type { LegacyCipher } from './legacy.ts';

const MAX_INPUT = 1_000_000;
const utf8 = new TextEncoder();

export type CipherName = 'aes-gcm' | LegacyCipher;
export type KdfName = 'scrypt' | 'pbkdf2';

export const CIPHERS: ReadonlyArray<{ value: CipherName; label: string; legacy?: string }> = [
  { value: 'aes-gcm', label: 'AES-GCM' },
  {
    value: 'tripledes',
    label: 'TripleDES',
    legacy: 'TripleDES is decrypt-only. Its 64-bit block and short keys are not safe for new data.',
  },
  { value: 'rabbit', label: 'Rabbit', legacy: 'Rabbit is decrypt-only. Do not encrypt new messages with it.' },
  { value: 'rc4', label: 'RC4', legacy: 'RC4 is decrypt-only. The cipher is broken; use it only to read old data.' },
];

export interface EncryptOptions {
  cipher?: CipherName;
  /** 16-byte salt followed by a 12-byte nonce, used when the text does not include them. */
  random?: Uint8Array;
}

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set([
    'mode',
    'cipher',
    'password',
    'kdf',
    'n',
    'salt-hex',
    'nonce-hex',
    'iv-hex',
    'key-hex',
    'padding',
  ]);
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

function parseHex(value: string | undefined, label: string, size?: number): Uint8Array | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const hex = value.trim().replace(/\s+/g, '');
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new ToolInputError(`${label} must be hex.`);
  const bytes = hexToBytes(hex);
  if (size !== undefined && bytes.length !== size) throw new ToolInputError(`${label} must be ${size} bytes.`);
  return bytes;
}

export function cipherName(value: string | undefined, fallback: CipherName = 'aes-gcm'): CipherName {
  const id = (value ?? fallback).trim().toLowerCase();
  if (id === 'aes-gcm' || id === 'aes' || id === 'gcm') return 'aes-gcm';
  if (id === 'tripledes' || id === '3des' || id === 'des-ede3') return 'tripledes';
  if (id === 'rabbit') return 'rabbit';
  if (id === 'rc4') return 'rc4';
  throw new ToolInputError('Cipher must be aes-gcm, tripledes, rabbit or rc4.');
}

/** Cipher named in the text, otherwise the menu selection. Used to show the legacy notice. */
export function cipherFromInput(input: string, fallback: CipherName = 'aes-gcm'): CipherName {
  const match = /^cipher:\s*(\S+)/im.exec(input);
  try {
    return cipherName(match?.[1], fallback);
  } catch {
    return fallback;
  }
}

function kdfName(value: string | undefined): KdfName {
  const id = (value ?? 'scrypt').trim().toLowerCase();
  if (id === 'scrypt' || id === 'pbkdf2') return id;
  throw new ToolInputError('KDF must be scrypt or pbkdf2.');
}

function cost(value: string | undefined, kdf: KdfName): number {
  if (value === undefined || value.trim() === '') return kdf === 'scrypt' ? 16384 : 100_000;
  if (!/^\d+$/.test(value.trim())) throw new ToolInputError('n must be a whole number.');
  const n = Number(value.trim());
  if (kdf === 'scrypt') {
    if (n < 1024 || n > 65536 || (n & (n - 1)) !== 0) {
      throw new ToolInputError('scrypt N must be a power of two from 1024 to 65536.');
    }
    return n;
  }
  if (n < 1000 || n > 1_000_000) throw new ToolInputError('PBKDF2 iterations must be from 1000 to 1000000.');
  return n;
}

function derive(password: string, salt: Uint8Array, kdf: KdfName, n: number): Uint8Array {
  const pass = utf8.encode(password);
  try {
    if (kdf === 'pbkdf2') return pbkdf2(sha256, pass, salt, { c: n, dkLen: 32 });
    return scrypt(pass, salt, { N: n, r: 8, p: 1, dkLen: 32 });
  } catch (error) {
    throw new ToolInputError(error instanceof Error ? error.message : 'Key derivation failed.');
  }
}

function toText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return `hex: ${bytesToHex(bytes)}`;
  }
}

function parseBodyHex(body: string): Uint8Array {
  const hex = body.trim().replace(/\s+/g, '');
  if (hex === '' || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new ToolInputError('Ciphertext must be hex.');
  return hexToBytes(hex);
}

function aesEncrypt(
  password: string,
  plain: Uint8Array,
  salt: Uint8Array,
  nonce: Uint8Array,
  kdf: KdfName,
  n: number,
): string {
  const ct = gcm(derive(password, salt, kdf, n), nonce).encrypt(plain);
  return [
    'xt1',
    kdf,
    String(n),
    '8',
    '1',
    base64nopad.encode(salt),
    base64nopad.encode(nonce),
    base64nopad.encode(ct),
  ].join('.');
}

function aesDecrypt(password: string, token: string): string {
  const parts = token.trim().split('.');
  if (parts.length !== 8 || parts[0] !== 'xt1') throw new ToolInputError('Ciphertext is not an xt1 AES-GCM token.');
  const kdf = kdfName(parts[1]);
  const n = cost(parts[2], kdf);
  let salt: Uint8Array;
  let nonce: Uint8Array;
  let ct: Uint8Array;
  try {
    salt = base64nopad.decode(parts[5]!);
    nonce = base64nopad.decode(parts[6]!);
    ct = base64nopad.decode(parts[7]!);
  } catch {
    throw new ToolInputError('Ciphertext is not an xt1 AES-GCM token.');
  }
  if (salt.length !== 16 || nonce.length !== 12)
    throw new ToolInputError('Ciphertext salt or nonce has the wrong length.');
  try {
    return toText(gcm(derive(password, salt, kdf, n), nonce).decrypt(ct));
  } catch {
    throw new ToolInputError('Decryption failed. Check the password and ciphertext.');
  }
}

async function legacyDecrypt(cipher: LegacyCipher, headers: Record<string, string>, body: string): Promise<string> {
  const { decryptLegacy, evpBytesToKey } = await import('./legacy.ts');
  const padding = (headers.padding ?? 'pkcs7').trim().toLowerCase() === 'none' ? 'none' : 'pkcs7';
  let key = parseHex(headers['key-hex'], 'key-hex');
  let iv = parseHex(headers['iv-hex'], 'iv-hex');
  const compact = body.trim().replace(/\s+/g, '');
  let data: Uint8Array;
  if (compact.startsWith('U2FsdGVk')) {
    let raw: Uint8Array;
    try {
      raw = base64.decode(compact);
    } catch {
      throw new ToolInputError('Ciphertext is not valid Base64.');
    }
    const magic = utf8.encode('Salted__');
    if (raw.length < 16 || !magic.every((b, i) => raw[i] === b))
      throw new ToolInputError('Expected OpenSSL Salted__ data.');
    const sizes = cipher === 'rc4' ? [16, 0] : cipher === 'rabbit' ? [16, 8] : [24, 8];
    const derived = evpBytesToKey(utf8.encode(headers.password ?? ''), raw.slice(8, 16), sizes[0]!, sizes[1]!);
    key = derived.key;
    if (sizes[1]) iv = derived.iv;
    data = raw.slice(16);
  } else {
    data = parseBodyHex(body);
  }
  if (!key) throw new ToolInputError('Add key-hex, or a password with OpenSSL Salted__ data.');
  return toText(decryptLegacy(cipher, key, iv, data, padding));
}

/**
 * Encrypts with AES-GCM (scrypt or PBKDF2) or decrypts TripleDES, Rabbit or RC4.
 * Salt and nonce come from the text, or from `options.random` (16 + 12 bytes).
 */
export async function textEncrypt(input: string, options: EncryptOptions = {}): Promise<string> {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const { headers, body } = headersAndBody(input);
  const cipher = cipherName(headers.cipher, options.cipher ?? 'aes-gcm');
  const mode = (headers.mode ?? (body.trim().startsWith('xt1.') ? 'decrypt' : 'encrypt')).trim().toLowerCase();
  if (mode !== 'encrypt' && mode !== 'decrypt') throw new ToolInputError('mode must be encrypt or decrypt.');
  if (cipher !== 'aes-gcm') {
    if (mode !== 'decrypt') throw new ToolInputError(`${cipher} is decrypt-only.`);
    return legacyDecrypt(cipher, headers, body);
  }
  if (headers.password === undefined) throw new ToolInputError('Add a password: line.');
  if (mode === 'decrypt') return aesDecrypt(headers.password, body.trim());
  const kdf = kdfName(headers.kdf);
  const n = cost(headers.n, kdf);
  let salt = parseHex(headers['salt-hex'], 'salt-hex', 16);
  let nonce = parseHex(headers['nonce-hex'], 'nonce-hex', 12);
  if (!salt || !nonce) {
    const random = options.random;
    if (!random || random.length < 28) throw new ToolInputError('Salt and nonce are missing.');
    salt ??= random.slice(0, 16);
    nonce ??= random.slice(16, 28);
  }
  return aesEncrypt(headers.password, utf8.encode(body), salt, nonce, kdf, n);
}
