import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { parseByteLength, parseCount, tokenGenerator } from './logic.ts';

const zeros = (n: number) => new Uint8Array(n);
const ff = (n: number) => new Uint8Array(n).fill(0xff);

describe('tokenGenerator', () => {
  it('encodes a fixed byte string as hex, base64 and base64url', () => {
    expect(tokenGenerator(1, zeros, 32, 'hex')[0]).toBe('0'.repeat(64));
    expect(tokenGenerator(1, zeros, 32, 'base64')[0]).toBe('A'.repeat(43) + '=');
    expect(tokenGenerator(1, zeros, 32, 'base64url')[0]).toBe('A'.repeat(43));
    expect(tokenGenerator(1, ff, 8, 'hex')[0]).toBe('ffffffffffffffff');
  });

  it('generates the requested number of values', () => {
    expect(tokenGenerator(3, zeros)).toHaveLength(3);
    const ids = tokenGenerator(20, (n) => crypto.getRandomValues(new Uint8Array(n)), 16, 'hex');
    expect(new Set(ids).size).toBe(20);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('rejects a short random source', () => {
    expect(() => tokenGenerator(1, () => new Uint8Array(4), 8, 'hex')).toThrow(ToolInputError);
  });
});

describe('parseCount and parseByteLength', () => {
  it('parses and limits the fields', () => {
    expect(parseCount('')).toBe(1);
    expect(parseCount(' 5 ')).toBe(5);
    expect(() => parseCount('0')).toThrow(ToolInputError);
    expect(() => parseCount('abc')).toThrow(ToolInputError);
    expect(parseByteLength('')).toBe(32);
    expect(parseByteLength('16')).toBe(16);
    expect(() => parseByteLength('7')).toThrow(ToolInputError);
    expect(() => parseByteLength('513')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed count input', () => {
    expectRobust(parseCount);
    expectRobust(parseByteLength);
  });
});
