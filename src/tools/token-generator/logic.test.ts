import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import {
  encodeRandom,
  opensslCommand,
  parseByteLength,
  parseCount,
  randomBytes,
  readRandom,
  tokenGenerator,
  wrap64,
} from './logic.ts';

const zeros = (n: number) => new Uint8Array(n);
const ff = (n: number) => new Uint8Array(n).fill(0xff);

describe('tokenGenerator', () => {
  it('encodes a fixed byte string as hex, base64 and base64url', () => {
    expect(tokenGenerator(1, zeros, 32, 'hex')[0]).toBe('0'.repeat(64));
    expect(tokenGenerator(1, zeros, 32, 'base64')[0]).toBe('A'.repeat(43) + '=');
    expect(tokenGenerator(1, zeros, 32, 'base64url')[0]).toBe('A'.repeat(43));
    expect(tokenGenerator(1, ff, 8, 'hex')[0]).toBe('ffffffffffffffff');
    expect(tokenGenerator(1, ff, 1, 'hex')[0]).toBe('ff');
  });

  it('wraps long base64 at 64 columns, like openssl rand -base64', () => {
    const text = encodeRandom(zeros(96), 'base64');
    expect(text).toBe(`${'A'.repeat(64)}\n${'A'.repeat(64)}`);
    expect(wrap64('A'.repeat(64))).toBe('A'.repeat(64));
  });

  it('generates the requested number of values', () => {
    expect(tokenGenerator(3, zeros)).toHaveLength(3);
    const ids = tokenGenerator(20, (n) => crypto.getRandomValues(new Uint8Array(n)), 16, 'hex');
    expect(new Set(ids).size).toBe(20);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('reads more than one getRandomValues quota in chunks', () => {
    const calls: number[] = [];
    const bytes = readRandom(70_000, (n) => {
      calls.push(n);
      return new Uint8Array(n);
    });
    expect(bytes).toHaveLength(70_000);
    expect(calls).toEqual([65_536, 4_464]);
  });

  it('concatenates raw blocks for a binary download', () => {
    const raw = randomBytes(4, 2, ff);
    expect([...raw]).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it('names the matching openssl rand command', () => {
    expect(opensslCommand(32, 'hex')).toBe('openssl rand -hex 32');
    expect(opensslCommand(16, 'base64')).toBe('openssl rand -base64 16');
    expect(opensslCommand(32, 'binary')).toBe('openssl rand -out random.bin 32');
  });

  it('rejects a short random source and an oversized total', () => {
    expect(() => tokenGenerator(1, () => new Uint8Array(4), 8, 'hex')).toThrow(ToolInputError);
    expect(() => tokenGenerator(3, zeros, 500_000, 'hex')).toThrow(ToolInputError);
  });
});

describe('parseCount and parseByteLength', () => {
  it('parses and limits the fields', () => {
    expect(parseCount('')).toBe(1);
    expect(parseCount(' 5 ')).toBe(5);
    expect(() => parseCount('0')).toThrow(ToolInputError);
    expect(() => parseCount('abc')).toThrow(ToolInputError);
    expect(parseByteLength('')).toBe(32);
    expect(parseByteLength('1')).toBe(1);
    expect(parseByteLength('16')).toBe(16);
    expect(parseByteLength('513')).toBe(513);
    expect(() => parseByteLength('0')).toThrow(ToolInputError);
    expect(() => parseByteLength('1048577')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed count input', () => {
    expectRobust(parseCount);
    expectRobust(parseByteLength);
  });
});
