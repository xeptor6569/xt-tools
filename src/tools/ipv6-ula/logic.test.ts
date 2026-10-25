import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { ipv6Ula, parseCount } from './logic.ts';

const fixed =
  (...bytes: number[]) =>
  (n: number) => {
    if (n !== bytes.length) throw new Error(`asked for ${n}`);
    return Uint8Array.from(bytes);
  };

describe('ipv6Ula', () => {
  it('builds an fd00::/48 from 40 random bits', () => {
    expect(ipv6Ula(1, fixed(0x12, 0x34, 0x56, 0x78, 0x9a))).toEqual(['fd12:3456:789a::/48']);
    expect(ipv6Ula(1, fixed(0, 0, 0, 0, 0))).toEqual(['fd00::/48']);
    expect(ipv6Ula(1, fixed(0x00, 0x01, 0x00, 0x00, 0x00))).toEqual(['fd00:100::/48']);
    expect(ipv6Ula(1, fixed(0xff, 0xff, 0xff, 0xff, 0xff))).toEqual(['fdff:ffff:ffff::/48']);
  });

  it('returns one prefix per count and repeats a fixed source', () => {
    const prefixes = ipv6Ula(3, fixed(0xab, 0xcd, 0xef, 0x01, 0x23));
    expect(prefixes).toEqual(['fdab:cdef:123::/48', 'fdab:cdef:123::/48', 'fdab:cdef:123::/48']);
  });

  it('rejects a bad count or a short random buffer', () => {
    expect(() => ipv6Ula(0, fixed(1, 2, 3, 4, 5))).toThrow(ToolInputError);
    expect(() => ipv6Ula(1, () => new Uint8Array(4))).toThrow(ToolInputError);
  });
});

describe('parseCount', () => {
  it('parses and limits the count', () => {
    expect(parseCount('')).toBe(1);
    expect(parseCount('10')).toBe(10);
    expect(() => parseCount('1001')).toThrow(ToolInputError);
    expect(() => parseCount('-1')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(parseCount);
  });
});
