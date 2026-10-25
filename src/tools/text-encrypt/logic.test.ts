import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { rabbitKeystream, rc4, tripleDesDecrypt } from './legacy.ts';
import { textEncrypt } from './logic.ts';
import { hexToBytes } from '@noble/hashes/utils.js';

const enc = new TextEncoder();

describe('textEncrypt AES-GCM', () => {
  const input = [
    'password: secret',
    'kdf: scrypt',
    'n: 1024',
    'salt-hex: 00112233445566778899aabbccddeeff',
    'nonce-hex: 00112233445566778899aabb',
    'hello',
  ].join('\n');

  it('round-trips a fixed salt and nonce', async () => {
    const token = await textEncrypt(input);
    expect(token.startsWith('xt1.scrypt.1024.8.1.')).toBe(true);
    expect(await textEncrypt(`mode: decrypt\npassword: secret\n${token}`)).toBe('hello');
    await expect(textEncrypt(`mode: decrypt\npassword: wrong\n${token}`)).rejects.toThrow(ToolInputError);
  });

  it('refuses to encrypt with a legacy cipher', async () => {
    await expect(textEncrypt('cipher: rc4\nmode: encrypt\npassword: x\nhello')).rejects.toThrow(/decrypt-only/);
  });
});

describe('legacy decrypt', () => {
  it('decrypts the RC4 vector for key "Key" and plaintext "Plaintext"', async () => {
    const out = await textEncrypt('mode: decrypt\ncipher: rc4\nkey-hex: 4b6579\nbbf316e8d940af0ad3');
    expect(out).toBe('Plaintext');
    expect(rc4(enc.encode('Key'), hexToBytes('bbf316e8d940af0ad3'))).toEqual(enc.encode('Plaintext'));
  });

  it('decrypts the FIPS DES block with three equal TripleDES keys', () => {
    const key = hexToBytes('133457799bbcdff1'.repeat(3));
    const ct = hexToBytes('85e813540f0ab405');
    const pt = tripleDesDecrypt(key, new Uint8Array(8), ct, 'none');
    expect([...pt].map((b) => b.toString(16).padStart(2, '0')).join('')).toBe('0123456789abcdef');
  });

  it('matches RFC 4503 appendix A.1 keystream (zero key, no IV)', () => {
    const stream = rabbitKeystream(new Uint8Array(16), undefined, 3);
    const hex = [...stream].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex.slice(0, 32)).toBe('b15754f036a5d6ecf56b45261c4af702');
    expect(hex.slice(32, 64)).toBe('88e8d815c59c0c397b696c4789c68aa7');
    expect(hex.slice(64, 96)).toBe('f416a1c3700cd451da68d1881673d696');
  });

  it('matches RFC 4503 appendix A.2 with an IV', () => {
    const stream = rabbitKeystream(new Uint8Array(16), hexToBytes('c373f575c1267e59'), 1);
    const hex = [...stream].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe('1fcd4eb9580012e2e0dccc9222017d6d');
  });
});

describe('robustness', () => {
  it('returns nothing for an empty box', async () => {
    expect(await textEncrypt('')).toBe('');
    expect(await textEncrypt(' \n ')).toBe('');
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync(textEncrypt);
  });
});
