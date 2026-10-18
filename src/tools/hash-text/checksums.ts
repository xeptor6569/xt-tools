// Non-cryptographic checksums. Fast and good at catching accidental
// corruption, useless against deliberate tampering.

let crcTable: Uint32Array | undefined;

export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function adler32(bytes: Uint8Array): number {
  const MOD = 65521;
  let a = 1;
  let b = 0;
  // Process in blocks small enough that the sums can't overflow before the modulo.
  for (let i = 0; i < bytes.length;) {
    const end = Math.min(i + 3800, bytes.length);
    for (; i < end; i++) {
      a += bytes[i]!;
      b += a;
    }
    a %= MOD;
    b %= MOD;
  }
  return ((b << 16) | a) >>> 0;
}

const M64 = (1n << 64n) - 1n;
const P1 = 0x9e3779b185ebca87n;
const P2 = 0xc2b2ae3d27d4eb4fn;
const P3 = 0x165667b19e3779f9n;
const P4 = 0x85ebca77c2b2ae63n;
const P5 = 0x27d4eb2f165667c5n;

const rotl = (x: bigint, r: bigint) => ((x << r) | (x >> (64n - r))) & M64;
const round = (acc: bigint, input: bigint) => (rotl((acc + input * P2) & M64, 31n) * P1) & M64;
const merge = (acc: bigint, val: bigint) => ((acc ^ round(0n, val)) * P1 + P4) & M64;

/** xxHash64 (seed 0) of the bytes, as a BigInt. */
export function xxhash64(bytes: Uint8Array, seed = 0n): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.length;
  const u64 = (i: number) => view.getBigUint64(i, true);
  let i = 0;
  let h: bigint;
  if (len >= 32) {
    let v1 = (seed + P1 + P2) & M64;
    let v2 = (seed + P2) & M64;
    let v3 = seed & M64;
    let v4 = (seed - P1) & M64;
    for (; i <= len - 32; i += 32) {
      v1 = round(v1, u64(i));
      v2 = round(v2, u64(i + 8));
      v3 = round(v3, u64(i + 16));
      v4 = round(v4, u64(i + 24));
    }
    h = (rotl(v1, 1n) + rotl(v2, 7n) + rotl(v3, 12n) + rotl(v4, 18n)) & M64;
    h = merge(h, v1);
    h = merge(h, v2);
    h = merge(h, v3);
    h = merge(h, v4);
  } else {
    h = (seed + P5) & M64;
  }
  h = (h + BigInt(len)) & M64;
  for (; i + 8 <= len; i += 8) h = (rotl(h ^ round(0n, u64(i)), 27n) * P1 + P4) & M64;
  if (i + 4 <= len) {
    h = (rotl(h ^ ((BigInt(view.getUint32(i, true)) * P1) & M64), 23n) * P2 + P3) & M64;
    i += 4;
  }
  for (; i < len; i++) h = (rotl(h ^ ((BigInt(bytes[i]!) * P5) & M64), 11n) * P1) & M64;
  h ^= h >> 33n;
  h = (h * P2) & M64;
  h ^= h >> 29n;
  h = (h * P3) & M64;
  h ^= h >> 32n;
  return h;
}
