import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import {
  mulberry32,
  normalizeSeed,
  parseBound,
  parseCount,
  parseDice,
  parseSeed,
  randomIntegers,
  rollDice,
  seedFromBytes,
  shuffleLines,
} from './logic.ts';

describe('random numbers', () => {
  it('draws a stable mulberry32 sequence from a numeric seed', () => {
    expect(randomIntegers(5, 1, 100, 1)).toEqual([68, 34, 88, 22, 4]);
    expect(randomIntegers(5, 1, 100, 1)).toEqual(randomIntegers(5, 1, 100, 1));
    expect(randomIntegers(5, 1, 100, 2)).not.toEqual(randomIntegers(5, 1, 100, 1));
  });

  it('accepts seed bytes and stays inside the inclusive range', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const seed = seedFromBytes(bytes);
    expect(normalizeSeed(bytes)).toBe(seed);
    expect(randomIntegers(4, 1, 100, bytes)).toEqual(randomIntegers(4, 1, 100, seed));
    const seen = new Set<number>();
    for (let s = 0; s < 40; s++) for (const n of randomIntegers(20, 1, 3, s)) seen.add(n);
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(mulberry32(1)()).toBeGreaterThanOrEqual(0);
  });

  it('rolls NdM dice and shuffles lines', () => {
    const roll = rollDice('2d6', 3, 7);
    expect(roll).toHaveLength(3);
    expect(rollDice('2d6', 3, 7)).toEqual(roll);
    for (const line of roll) {
      const faces = line.split(' = ')[0]!.split(' + ').map(Number);
      expect(faces).toHaveLength(2);
      for (const face of faces) expect(face).toBeGreaterThanOrEqual(1);
      for (const face of faces) expect(face).toBeLessThanOrEqual(6);
    }
    const shuffled = shuffleLines('a\nb\nc\nd\ne', 1);
    expect(shuffled.split('\n').sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(shuffleLines('a\nb\nc\nd\ne', 1)).toBe(shuffled);
    expect(() => parseDice('nope')).toThrow(ToolInputError);
  });

  it('parses the seed and the count', () => {
    expect(parseSeed('')).toBeUndefined();
    expect(parseSeed('1')).toBe(1);
    expect(parseCount('')).toBe(1);
    expect(parseCount('5')).toBe(5);
    expect(parseBound('-3', 'Min')).toBe(-3);
    expect(() => parseSeed('hello')).toThrow(ToolInputError);
    expect(() => parseCount('0')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(parseSeed);
    expectRobust(parseCount);
    expectRobust((input) => parseBound(input, 'Min'));
    expectRobust(parseDice);
    expectRobust((input) => shuffleLines(input, 1));
  });
});
