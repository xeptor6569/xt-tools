// Decrypt-only legacy ciphers. Loaded on demand so AES-GCM pages do not ship them.
import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { ToolInputError } from '../types.ts';

export type LegacyCipher = 'tripledes' | 'rabbit' | 'rc4';

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** OpenSSL EVP_BytesToKey with one MD5 iteration, as used by CryptoJS passphrase mode. */
export function evpBytesToKey(
  password: Uint8Array,
  salt: Uint8Array,
  keyLen: number,
  ivLen: number,
): { key: Uint8Array; iv: Uint8Array } {
  const need = keyLen + ivLen;
  const blocks: Uint8Array[] = [];
  let prev = new Uint8Array();
  let got = 0;
  while (got < need) {
    const block = md5(concat([prev, password, salt]));
    blocks.push(block);
    got += block.length;
    prev = block;
  }
  const all = concat(blocks);
  return { key: all.slice(0, keyLen), iv: all.slice(keyLen, keyLen + ivLen) };
}

export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  if (key.length === 0) throw new ToolInputError('RC4 needs a key.');
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 255;
    const t = s[i]!;
    s[i] = s[j]!;
    s[j] = t;
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]!) & 255;
    const t = s[i]!;
    s[i] = s[j]!;
    s[j] = t;
    out[n] = data[n]! ^ s[(s[i]! + s[j]!) & 255]!;
  }
  return out;
}

const A = Uint32Array.from([
  0x4d34d34d, 0xd34d34d3, 0x34d34d34, 0x4d34d34d, 0xd34d34d3, 0x34d34d34, 0x4d34d34d, 0xd34d34d3,
]);

function g(u: number, v: number): number {
  const s = (u + v) >>> 0;
  const sq = BigInt(s) * BigInt(s);
  return (Number(sq & 0xffffffffn) ^ Number(sq >> 32n)) >>> 0;
}

function rotl(n: number, s: number): number {
  return ((n << s) | (n >>> (32 - s))) >>> 0;
}

function nextState(x: Uint32Array, c: Uint32Array, carry: number): number {
  let b = carry;
  for (let j = 0; j < 8; j++) {
    const sum = c[j]! + A[j]! + b;
    b = Math.floor(sum / 0x100000000);
    c[j] = sum >>> 0;
  }
  const G = new Uint32Array(8);
  for (let j = 0; j < 8; j++) G[j] = g(x[j]!, c[j]!);
  const add = (p: number, q: number, r: number) => (p + q + r) >>> 0;
  x[0] = add(G[0]!, rotl(G[7]!, 16), rotl(G[6]!, 16));
  x[1] = add(G[1]!, rotl(G[0]!, 8), G[7]!);
  x[2] = add(G[2]!, rotl(G[1]!, 16), rotl(G[0]!, 16));
  x[3] = add(G[3]!, rotl(G[2]!, 8), G[1]!);
  x[4] = add(G[4]!, rotl(G[3]!, 16), rotl(G[2]!, 16));
  x[5] = add(G[5]!, rotl(G[4]!, 8), G[3]!);
  x[6] = add(G[6]!, rotl(G[5]!, 16), rotl(G[4]!, 16));
  x[7] = add(G[7]!, rotl(G[6]!, 8), G[5]!);
  return b;
}

function extract(x: Uint32Array): Uint8Array {
  const w = [
    (x[6]! >>> 16) ^ (x[1]! & 0xffff),
    (x[6]! & 0xffff) ^ (x[3]! >>> 16),
    (x[4]! >>> 16) ^ (x[7]! & 0xffff),
    (x[4]! & 0xffff) ^ (x[1]! >>> 16),
    (x[2]! >>> 16) ^ (x[5]! & 0xffff),
    (x[2]! & 0xffff) ^ (x[7]! >>> 16),
    (x[0]! >>> 16) ^ (x[3]! & 0xffff),
    (x[0]! & 0xffff) ^ (x[5]! >>> 16),
  ];
  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    out[i * 2] = w[i]! >> 8;
    out[i * 2 + 1] = w[i]! & 0xff;
  }
  return out;
}

function subkey(key: Uint8Array, j: number): number {
  const i = 14 - 2 * j;
  return ((key[i]! << 8) | key[i + 1]!) & 0xffff;
}

/** RFC 4503 keystream. `key` is 16 octets (big-endian OS2IP), `iv` is 8 octets or omitted. */
export function rabbitKeystream(key: Uint8Array, iv: Uint8Array | undefined, blocks: number): Uint8Array {
  if (key.length !== 16) throw new ToolInputError('Rabbit needs a 16-byte key.');
  if (iv && iv.length !== 8) throw new ToolInputError('Rabbit IV must be 8 bytes.');
  const K = Array.from({ length: 8 }, (_, j) => subkey(key, j));
  const x = new Uint32Array(8);
  const c = new Uint32Array(8);
  for (let j = 0; j < 8; j++) {
    if (j % 2 === 0) {
      x[j] = ((K[(j + 1) % 8]! << 16) | K[j]!) >>> 0;
      c[j] = ((K[(j + 4) % 8]! << 16) | K[(j + 5) % 8]!) >>> 0;
    } else {
      x[j] = ((K[(j + 5) % 8]! << 16) | K[(j + 4) % 8]!) >>> 0;
      c[j] = ((K[j]! << 16) | K[(j + 1) % 8]!) >>> 0;
    }
  }
  let carry = 0;
  for (let i = 0; i < 4; i++) carry = nextState(x, c, carry);
  for (let j = 0; j < 8; j++) c[j] = (c[j]! ^ x[(j + 4) % 8]!) >>> 0;
  if (iv) {
    const hi = ((iv[0]! << 24) | (iv[1]! << 16) | (iv[2]! << 8) | iv[3]!) >>> 0;
    const lo = ((iv[4]! << 24) | (iv[5]! << 16) | (iv[6]! << 8) | iv[7]!) >>> 0;
    const mix = (top: number, bot: number) => ((top << 16) | bot) >>> 0;
    const c1 = mix(hi >>> 16, lo >>> 16);
    const c3 = mix(hi & 0xffff, lo & 0xffff);
    c[0] = (c[0]! ^ lo) >>> 0;
    c[1] = (c[1]! ^ c1) >>> 0;
    c[2] = (c[2]! ^ hi) >>> 0;
    c[3] = (c[3]! ^ c3) >>> 0;
    c[4] = (c[4]! ^ lo) >>> 0;
    c[5] = (c[5]! ^ c1) >>> 0;
    c[6] = (c[6]! ^ hi) >>> 0;
    c[7] = (c[7]! ^ c3) >>> 0;
    for (let i = 0; i < 4; i++) carry = nextState(x, c, carry);
  }
  const out = new Uint8Array(blocks * 16);
  for (let i = 0; i < blocks; i++) {
    carry = nextState(x, c, carry);
    out.set(extract(x), i * 16);
  }
  return out;
}

export function rabbitDecrypt(key: Uint8Array, iv: Uint8Array | undefined, data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / 16));
  const stream = rabbitKeystream(key, iv, blocks);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i]! ^ stream[i]!;
  return out;
}

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24,
  16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31,
  23, 15, 7,
];
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21,
  61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49,
  17, 57, 25,
];
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22,
  23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
];
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
];
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55,
  47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
];
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30,
  40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
];
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const SBOX: number[][] = [
  [
    14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1,
    14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13,
  ],
  [
    15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14,
    7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9,
  ],
  [
    10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6,
    4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12,
  ],
  [
    7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6,
    9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14,
  ],
  [
    2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1,
    11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3,
  ],
  [
    12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14,
    15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13,
  ],
  [
    4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4,
    11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12,
  ],
  [
    13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11,
    4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11,
  ],
];

function bit(block: bigint, pos: number, width: number): bigint {
  return (block >> BigInt(width - pos)) & 1n;
}

function permute(block: bigint, width: number, table: readonly number[]): bigint {
  let out = 0n;
  for (const pos of table) out = (out << 1n) | bit(block, pos, width);
  return out;
}

function rotl28(n: bigint, s: number): bigint {
  return ((n << BigInt(s)) | (n >> BigInt(28 - s))) & 0x0fffffffn;
}

function desSubkeys(key8: Uint8Array): bigint[] {
  if (key8.length !== 8) throw new ToolInputError('A DES key is 8 bytes.');
  let key = 0n;
  for (const b of key8) key = (key << 8n) | BigInt(b);
  const cd = permute(key, 64, PC1);
  let c = cd >> 28n;
  let d = cd & 0x0fffffffn;
  const keys: bigint[] = [];
  for (const shift of SHIFTS) {
    c = rotl28(c, shift);
    d = rotl28(d, shift);
    keys.push(permute((c << 28n) | d, 56, PC2));
  }
  return keys;
}

function f(r: bigint, sub: bigint): bigint {
  const x = permute(r, 32, E) ^ sub;
  let sOut = 0n;
  for (let i = 0; i < 8; i++) {
    const six = Number((x >> BigInt((7 - i) * 6)) & 0x3fn);
    const row = ((six & 0x20) >> 4) | (six & 1);
    const col = (six >> 1) & 0x0f;
    sOut = (sOut << 4n) | BigInt(SBOX[i]![row * 16 + col]!);
  }
  return permute(sOut, 32, P);
}

function desBlock(block: bigint, subkeys: bigint[], decrypt: boolean): bigint {
  const ip = permute(block, 64, IP);
  let l = ip >> 32n;
  let r = ip & 0xffffffffn;
  for (const k of decrypt ? [...subkeys].reverse() : subkeys) {
    const next = l ^ f(r, k);
    l = r;
    r = next;
  }
  return permute((r << 32n) | l, 64, FP);
}

function load64(bytes: Uint8Array, offset: number): bigint {
  let n = 0n;
  for (let i = 0; i < 8; i++) n = (n << 8n) | BigInt(bytes[offset + i]!);
  return n;
}

function store64(n: bigint): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

function tdesDecryptBlock(block: bigint, k1: bigint[], k2: bigint[], k3: bigint[]): bigint {
  return desBlock(desBlock(desBlock(block, k3, true), k2, false), k1, true);
}

export function tripleDesDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
  padding: 'pkcs7' | 'none',
): Uint8Array {
  if (key.length !== 16 && key.length !== 24) throw new ToolInputError('TripleDES key must be 16 or 24 bytes.');
  if (iv.length !== 8) throw new ToolInputError('TripleDES IV must be 8 bytes.');
  if (data.length === 0 || data.length % 8 !== 0)
    throw new ToolInputError('TripleDES ciphertext length must be a multiple of 8.');
  const k1 = desSubkeys(key.slice(0, 8));
  const k2 = desSubkeys(key.slice(8, 16));
  const k3 = desSubkeys(key.length === 24 ? key.slice(16, 24) : key.slice(0, 8));
  const out = new Uint8Array(data.length);
  let prev = load64(iv, 0);
  for (let off = 0; off < data.length; off += 8) {
    const c = load64(data, off);
    const p = tdesDecryptBlock(c, k1, k2, k3) ^ prev;
    out.set(store64(p), off);
    prev = c;
  }
  if (padding === 'none') return out;
  const pad = out[out.length - 1]!;
  if (pad < 1 || pad > 8) throw new ToolInputError('Decryption failed. Check the password, IV and ciphertext.');
  for (let i = 0; i < pad; i++) {
    if (out[out.length - 1 - i] !== pad)
      throw new ToolInputError('Decryption failed. Check the password, IV and ciphertext.');
  }
  return out.slice(0, out.length - pad);
}

export function decryptLegacy(
  cipher: LegacyCipher,
  key: Uint8Array,
  iv: Uint8Array | undefined,
  data: Uint8Array,
  padding: 'pkcs7' | 'none',
): Uint8Array {
  if (cipher === 'rc4') return rc4(key, data);
  if (cipher === 'rabbit') return rabbitDecrypt(key, iv, data);
  if (!iv) throw new ToolInputError('TripleDES needs an 8-byte iv-hex.');
  return tripleDesDecrypt(key, iv, data, padding);
}

export function describeLegacy(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}
