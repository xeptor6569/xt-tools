import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { hmacGenerator } from './logic.ts';

describe('hmacGenerator', () => {
  it('matches HMAC-SHA-256 of the fox sentence', () => {
    const input = 'key: key\nThe quick brown fox jumps over the lazy dog';
    expect(hmacGenerator(input)).toBe('sha256 f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  });

  it('matches RFC 2104 (MD5) and RFC 4231 / RFC 2202 case 1', () => {
    // RFC 2104 test 1: 16 bytes of 0x0b, data "Hi There".
    const md5 = 'algo: md5\nkey-hex: 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b\nHi There';
    expect(hmacGenerator(md5)).toBe('md5 9294727a3638bb1c13f48ef8158bfc9d');
    // RFC 2202 / RFC 4231 case 1: 20 bytes of 0x0b.
    const key = 'key-hex: 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b';
    expect(hmacGenerator(`algo: sha1\n${key}\nHi There`)).toBe('sha1 b617318655057264e28bc0b6fb378c8ef146be00');
    expect(hmacGenerator(`algo: sha256\n${key}\nHi There`)).toBe(
      'sha256 b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
    expect(hmacGenerator(`algo: sha384\n${key}\nHi There`)).toBe(
      'sha384 afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6',
    );
    expect(hmacGenerator(`algo: sha512\n${key}\nHi There`)).toBe(
      'sha512 87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854',
    );
  });

  it('returns nothing for an empty box and rejects a missing key', () => {
    expect(hmacGenerator('')).toBe('');
    expect(hmacGenerator('   ')).toBe('');
    expect(() => hmacGenerator('hello')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(hmacGenerator);
  });
});
