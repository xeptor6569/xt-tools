import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { totp, totpAt } from './logic.ts';
import { base32nopad } from '@scure/base';

const ascii = (s: string) => new TextEncoder().encode(s);
const b32 = (s: string) => base32nopad.encode(ascii(s));

/** RFC 6238 appendix B, 8 digits, period 30. */
const RFC: Array<[number, string, string, string]> = [
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826'],
];

describe('totp', () => {
  it('matches RFC 6238 appendix B for SHA-1, SHA-256 and SHA-512', () => {
    const sha1 = ascii('12345678901234567890');
    const sha256 = ascii('12345678901234567890123456789012');
    const sha512 = ascii('1234567890123456789012345678901234567890123456789012345678901234');
    for (const [t, a, b, c] of RFC) {
      expect(totpAt(sha1, t, 30, 8, 'sha1')).toBe(a);
      expect(totpAt(sha256, t, 30, 8, 'sha256')).toBe(b);
      expect(totpAt(sha512, t, 30, 8, 'sha512')).toBe(c);
    }
  });

  it('reads a Base32 secret and an explicit timestamp', () => {
    const secret = b32('12345678901234567890');
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    const out = totp(`secret: ${secret}\ndigits: 8\ntime: 59`);
    expect(out).toContain('code: 94287082');
    expect(totp(`secret: ${secret}\ndigits: 8\ntime: 59\ncode: 94287082`)).toContain('match');
    expect(totp(`secret: ${secret}\ndigits: 8\ntime: 59\ncode: 00000000`)).toContain('mismatch');
  });

  it('defaults to SHA-1, 30 seconds and 6 digits', () => {
    const secret = b32('12345678901234567890');
    // 8-digit code 94287082 ends with the 6-digit code only when the modulus differs;
    // pin the 6-digit value at the same counter instead of assuming a suffix.
    const six = totp(`secret: ${secret}\ntime: 59`);
    expect(six).toContain('code: ');
    expect(six).toContain('algorithm: sha1');
    expect(six).toMatch(/code: \d{6}/);
    expect(totpAt(ascii('12345678901234567890'), 59, 30, 6, 'sha1')).toBe('287082');
  });

  it('returns nothing for an empty box and rejects bad secrets', () => {
    expect(totp('')).toBe('');
    expect(() => totp('not base32 !!!')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(totp);
  });
});
