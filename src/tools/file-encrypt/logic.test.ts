import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { decryptBytes, encryptBytes, fileEncrypt } from './logic.ts';

const salt = new Uint8Array(16).map((_, i) => i);
const nonce = new Uint8Array(12).map((_, i) => i + 1);
const fixed = () => {
  const all = new Uint8Array(28);
  all.set(salt, 0);
  all.set(nonce, 16);
  return all;
};

describe('fileEncrypt', () => {
  it('round-trips text with a fixed salt and nonce', () => {
    const token = fileEncrypt(
      'password: secret\nn: 1024\nsalt-hex: 000102030405060708090a0b0c0d0e0f\nnonce-hex: 0102030405060708090a0b0c\nhello',
    );
    expect(token.startsWith('xtf1:')).toBe(true);
    expect(fileEncrypt(`mode: decrypt\npassword: secret\n${token}`)).toBe('hello');
    expect(() => fileEncrypt(`mode: decrypt\npassword: no\n${token}`)).toThrow(ToolInputError);
  });

  it('encrypts more than one chunk and decrypts it', () => {
    const plain = new Uint8Array(70_000).map((_, i) => i & 0xff);
    const blob = encryptBytes(plain, 'pw', salt, nonce, 1024);
    expect(decryptBytes(blob, 'pw')).toEqual(plain);
  });

  it('uses injected random bytes when the text omits the salt', () => {
    const token = fileEncrypt('password: secret\nn: 1024\nhello', fixed());
    expect(fileEncrypt(`mode: decrypt\npassword: secret\n${token}`)).toBe('hello');
  });

  it('returns nothing for an empty box', () => {
    expect(fileEncrypt('')).toBe('');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(fileEncrypt);
  });
});
