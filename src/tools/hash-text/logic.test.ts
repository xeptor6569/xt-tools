import * as oracle from 'hash-wasm';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { adler32, crc32, xxhash64 } from './checksums.ts';
import { hashText } from './logic.ts';

const byLabel = (input: string, format?: 'hex' | 'HEX' | 'base64') =>
  Object.fromEntries(hashText(input, format).map((h) => [h.label, h.value]));
const bytes = (s: string) => new TextEncoder().encode(s);

describe('known test vectors', () => {
  it('"abc" (FIPS 180-4, FIPS 202)', () => {
    const h = byLabel('abc');
    expect(h['SHA-256']).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(h['SHA-1']).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(h['SHA3-256']).toBe('3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532');
    expect(h['SHA-512']?.slice(0, 32)).toBe('ddaf35a193617abacc417349ae204131');
  });

  it('empty input', () => {
    const h = byLabel('');
    expect(h.MD5).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(h['RIPEMD-160']).toBe('9c1185a5c5e9fc54612808977ee8f548b2258d31');
    expect(h.BLAKE3).toBe('af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262');
    expect(h.xxHash64).toBe('ef46db3751d8e999');
    expect(h.xxHash32).toBe('02cc5d05');
    expect(h.CRC32).toBe('00000000');
    expect(h['Adler-32']).toBe('00000001');
  });

  it('checksum check values', () => {
    expect(crc32(bytes('123456789')).toString(16)).toBe('cbf43926');
    expect(adler32(bytes('Wikipedia')).toString(16)).toBe('11e60398');
  });

  it('formats as upper-case hex and Base64', () => {
    expect(byLabel('abc', 'HEX').MD5).toBe('900150983CD24FB0D6963F7D28E17F72');
    expect(byLabel('abc', 'base64')['SHA-256']).toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');
  });

  it('labels legacy algorithms and checksums', () => {
    const notes = Object.fromEntries(hashText('x').map((h) => [h.label, h.note ?? '']));
    expect(notes.MD5).toMatch(/Legacy/);
    expect(notes['SHA-1']).toMatch(/Legacy/);
    expect(notes.CRC32).toMatch(/not cryptographic/);
    expect(notes['SHA-256']).toBe('');
  });
});

describe('agrees with an independent implementation (hash-wasm)', () => {
  const samples = [
    '',
    'a',
    'The quick brown fox jumps over the lazy dog',
    'Ünïcödé 🚀',
    'x'.repeat(1000),
    'y'.repeat(100_003),
  ];
  for (const sample of samples) {
    it(`${sample.length} chars`, async () => {
      const h = byLabel(sample);
      expect(h.MD5).toBe(await oracle.md5(sample));
      expect(h['SHA-1']).toBe(await oracle.sha1(sample));
      expect(h['SHA-224']).toBe(await oracle.sha224(sample));
      expect(h['SHA-256']).toBe(await oracle.sha256(sample));
      expect(h['SHA-384']).toBe(await oracle.sha384(sample));
      expect(h['SHA-512']).toBe(await oracle.sha512(sample));
      expect(h['SHA3-224']).toBe(await oracle.sha3(sample, 224));
      expect(h['SHA3-256']).toBe(await oracle.sha3(sample, 256));
      expect(h['SHA3-384']).toBe(await oracle.sha3(sample, 384));
      expect(h['SHA3-512']).toBe(await oracle.sha3(sample, 512));
      expect(h['RIPEMD-160']).toBe(await oracle.ripemd160(sample));
      expect(h.BLAKE3).toBe(await oracle.blake3(sample));
      expect(h.CRC32).toBe(await oracle.crc32(sample));
      expect(h['Adler-32']).toBe(await oracle.adler32(sample));
      expect(h.xxHash32).toBe(await oracle.xxhash32(sample, 0));
      expect(h.xxHash64).toBe(await oracle.xxhash64(sample, 0, 0));
    });
  }

  it('xxHash64 across every tail length', async () => {
    for (let n = 0; n < 70; n++) {
      const s = 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(3).slice(0, n);
      expect(xxhash64(bytes(s)).toString(16).padStart(16, '0')).toBe(await oracle.xxhash64(s, 0, 0));
    }
  });
});

describe('robustness', () => {
  it('survives empty, huge and malformed input', () => {
    expectRobust(hashText, { timeLimitMs: 15_000 });
  });
});
