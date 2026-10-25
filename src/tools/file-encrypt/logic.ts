import { gcm } from '@noble/ciphers/aes.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { base64nopad } from '@scure/base';
import { ToolInputError } from '../types.ts';

const MAX_TEXT = 1_000_000;
const MAX_FILE = 64 * 1024 * 1024;
const CHUNK = 64 * 1024;
const utf8 = new TextEncoder();

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set(['mode', 'password', 'n', 'salt-hex', 'nonce-hex']);
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

function parseHex(value: string | undefined, label: string, size: number): Uint8Array | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const hex = value.trim().replace(/\s+/g, '');
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new ToolInputError(`${label} must be hex.`);
  const bytes = hexToBytes(hex);
  if (bytes.length !== size) throw new ToolInputError(`${label} must be ${size} bytes.`);
  return bytes;
}

function cost(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 16384;
  if (!/^\d+$/.test(value.trim())) throw new ToolInputError('n must be a whole number.');
  const n = Number(value.trim());
  if (n < 1024 || n > 65536 || (n & (n - 1)) !== 0) {
    throw new ToolInputError('scrypt N must be a power of two from 1024 to 65536.');
  }
  return n;
}

function derive(password: string, salt: Uint8Array, n: number): Uint8Array {
  try {
    return scrypt(utf8.encode(password), salt, { N: n, r: 8, p: 1, dkLen: 32 });
  } catch (error) {
    throw new ToolInputError(error instanceof Error ? error.message : 'Key derivation failed.');
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function chunkNonce(base: Uint8Array, counter: number): Uint8Array {
  const nonce = base.slice();
  const view = new DataView(nonce.buffer);
  view.setUint32(8, (view.getUint32(8) ^ counter) >>> 0);
  return nonce;
}

/** AES-GCM in 64 KiB chunks. Container is magic, scrypt params, salt, nonce, then length-prefixed chunks. */
export function encryptBytes(
  plain: Uint8Array,
  password: string,
  salt: Uint8Array,
  nonce: Uint8Array,
  n = 16384,
): Uint8Array {
  if (plain.length > MAX_FILE) throw new ToolInputError('File is too large (maximum 64 MB).');
  if (salt.length !== 16 || nonce.length !== 12)
    throw new ToolInputError('Salt must be 16 bytes and the nonce 12 bytes.');
  if (!password) throw new ToolInputError('A password is required.');
  const key = derive(password, salt, n);
  const header = new Uint8Array(4 + 4 + 1 + 1 + 4 + 16 + 12);
  header.set([0x58, 0x54, 0x46, 0x31], 0);
  const view = new DataView(header.buffer);
  view.setUint32(4, n);
  header[8] = 8;
  header[9] = 1;
  view.setUint32(10, CHUNK);
  header.set(salt, 14);
  header.set(nonce, 30);
  const parts: Uint8Array[] = [header];
  const total = Math.max(1, Math.ceil(plain.length / CHUNK));
  for (let i = 0; i < total; i++) {
    const slice = plain.subarray(i * CHUNK, Math.min(plain.length, (i + 1) * CHUNK));
    const ct = gcm(key, chunkNonce(nonce, i)).encrypt(slice);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, ct.length);
    parts.push(len, ct);
  }
  return concat(parts);
}

export function decryptBytes(container: Uint8Array, password: string): Uint8Array {
  if (container.length < 42) throw new ToolInputError('That is not an encrypted file.');
  if (container[0] !== 0x58 || container[1] !== 0x54 || container[2] !== 0x46 || container[3] !== 0x31) {
    throw new ToolInputError('That is not an xt file container.');
  }
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const n = view.getUint32(4);
  const salt = container.slice(14, 30);
  const nonce = container.slice(30, 42);
  const key = derive(password, salt, n);
  const parts: Uint8Array[] = [];
  let off = 42;
  let counter = 0;
  while (off + 4 <= container.length) {
    const len = view.getUint32(off);
    off += 4;
    if (len < 16 || off + len > container.length) throw new ToolInputError('The encrypted file is truncated.');
    const ct = container.subarray(off, off + len);
    off += len;
    try {
      parts.push(gcm(key, chunkNonce(nonce, counter)).decrypt(ct));
    } catch {
      throw new ToolInputError('Decryption failed. Check the password.');
    }
    counter++;
  }
  if (counter === 0) throw new ToolInputError('The encrypted file has no data.');
  return concat(parts);
}

function toText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return `hex: ${bytesToHex(bytes)}`;
  }
}

/**
 * Text form of the chunked file container.
 * Encrypt: password, optional n / salt-hex / nonce-hex, then the plaintext.
 * Decrypt: mode: decrypt, password, then an xtf1: base64 container.
 */
export function fileEncrypt(input: string, random?: Uint8Array): string {
  if (input.length > MAX_TEXT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const { headers, body } = headersAndBody(input);
  if (headers.password === undefined) throw new ToolInputError('Add a password: line.');
  const mode = (headers.mode ?? (body.trim().startsWith('xtf1:') ? 'decrypt' : 'encrypt')).trim().toLowerCase();
  if (mode === 'decrypt') {
    const payload = body
      .trim()
      .replace(/^xtf1:/, '')
      .replace(/\s+/g, '');
    let raw: Uint8Array;
    try {
      raw = base64nopad.decode(payload);
    } catch {
      throw new ToolInputError('Ciphertext must be base64, optionally prefixed with xtf1:.');
    }
    return toText(decryptBytes(raw, headers.password));
  }
  if (mode !== 'encrypt') throw new ToolInputError('mode must be encrypt or decrypt.');
  const n = cost(headers.n);
  let salt = parseHex(headers['salt-hex'], 'salt-hex', 16);
  let nonce = parseHex(headers['nonce-hex'], 'nonce-hex', 12);
  if (!salt || !nonce) {
    if (!random || random.length < 28) throw new ToolInputError('Salt and nonce are missing.');
    salt ??= random.slice(0, 16);
    nonce ??= random.slice(16, 28);
  }
  return `xtf1:${base64nopad.encode(encryptBytes(utf8.encode(body), headers.password, salt, nonce, n))}`;
}
