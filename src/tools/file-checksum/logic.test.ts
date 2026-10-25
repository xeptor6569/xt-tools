import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { checksumBytes, fileChecksum } from './logic.ts';

describe('fileChecksum', () => {
  it('matches the SHA-256 vector for "abc" (FIPS 180-4)', () => {
    expect(fileChecksum('abc')).toBe('SHA-256 ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes the empty string', () => {
    expect(fileChecksum('')).toBe('SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('compares an expected digest and reports match or mismatch', () => {
    const input = [
      'algo: SHA-256',
      'expect: ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      'abc',
    ].join('\n');
    expect(fileChecksum(input)).toContain('match');
    expect(fileChecksum('algo: MD5\nexpect: 0000\nabc')).toContain('mismatch');
    expect(fileChecksum('algo: MD5\nabc')).toContain('900150983cd24fb0d6963f7d28e17f72');
  });

  it('hashes file bytes with the same SHA-256 and a legacy label', () => {
    const bytes = new TextEncoder().encode('abc');
    expect(checksumBytes(bytes, 'SHA-256')).toContain(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(checksumBytes(bytes, 'SHA-1', 'A9993E364706816ABA3E25717850C26C9CD0D89D')).toContain('match');
    expect(checksumBytes(bytes, 'CRC32')).toContain('352441c2');
  });

  it('rejects an unknown algorithm', () => {
    expect(() => fileChecksum('algo: whirlpool\nabc')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(fileChecksum);
  });
});
