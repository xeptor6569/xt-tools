import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { parseCount, uuidGenerator, type UuidOptions } from './logic.ts';

const plain: UuidOptions = { version: 'v4', uppercase: false, hyphens: true, braces: false };
const fixed = (byte: number) => (n: number) => new Uint8Array(n).fill(byte);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('uuidGenerator', () => {
  it('sets the version and variant bits for v4', () => {
    const [id] = uuidGenerator(1, plain, fixed(0xff));
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    const [zero] = uuidGenerator(1, plain, fixed(0));
    expect(zero).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('produces unique, well-formed v4 UUIDs with real randomness', () => {
    const ids = uuidGenerator(500, plain, (n) => crypto.getRandomValues(new Uint8Array(n)));
    expect(new Set(ids).size).toBe(500);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it('encodes the timestamp in v7 (RFC 9562 appendix A.6 time value)', () => {
    // 2022-02-22T19:22:22Z = 0x017F22E279B0 ms
    const [id] = uuidGenerator(1, { ...plain, version: 'v7' }, fixed(0), 0x017f22e279b0);
    expect(id).toBe('017f22e2-79b0-7000-8000-000000000000');
  });

  it('keeps v7 UUIDs from one batch in creation order', () => {
    const ids = uuidGenerator(
      5000,
      { ...plain, version: 'v7' },
      (n) => crypto.getRandomValues(new Uint8Array(n)),
      1e12,
    );
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('supports nil, max and formatting options', () => {
    expect(uuidGenerator(1, { ...plain, version: 'nil' }, fixed(1))).toEqual(['00000000-0000-0000-0000-000000000000']);
    expect(uuidGenerator(1, { ...plain, version: 'max', uppercase: true, braces: true }, fixed(1))).toEqual([
      '{FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF}',
    ]);
    expect(uuidGenerator(1, { ...plain, hyphens: false }, fixed(0))[0]).toBe('00000000000040008000000000000000');
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
