import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { CROCKFORD, encodeUlidTime, parseCount, ulidGenerator } from './logic.ts';

const zeros = (n: number) => new Uint8Array(n);
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('ulidGenerator', () => {
  it('encodes the reference timestamp 1469918176385 as 01ARYZ6S41', () => {
    expect(encodeUlidTime(1469918176385)).toBe('01ARYZ6S41');
    expect(encodeUlidTime(0)).toBe('0000000000');
  });

  it('appends 80 zero bits as 16 Crockford zeros', () => {
    const [id] = ulidGenerator(1, zeros, 1469918176385);
    expect(id).toBe('01ARYZ6S410000000000000000');
    expect(id).toMatch(ULID);
    expect(id!.split('').every((c) => CROCKFORD.includes(c))).toBe(true);
  });

  it('keeps a batch in timestamp order and uses distinct randomness', () => {
    let i = 0;
    const ids = ulidGenerator(
      8,
      (n) => {
        const b = new Uint8Array(n);
        b[n - 1] = i++;
        return b;
      },
      1_700_000_000_000,
    );
    expect(ids).toHaveLength(8);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(8);
  });

  it('rejects a timestamp past 48 bits', () => {
    expect(() => ulidGenerator(1, zeros, 0x1_0000_0000_0000)).toThrow(ToolInputError);
  });
});

describe('parseCount', () => {
  it('parses and limits the count', () => {
    expect(parseCount('')).toBe(1);
    expect(parseCount(' 5 ')).toBe(5);
    expect(() => parseCount('0')).toThrow(ToolInputError);
    expect(() => parseCount('abc')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed count input', () => {
    expectRobust(parseCount);
  });
});
