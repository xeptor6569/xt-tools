import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { gradientGenerator, parseGradient } from './logic.ts';
import meta from './meta.ts';

describe('gradientGenerator', () => {
  it('builds a linear-gradient from an angle and two colors', () => {
    expect(gradientGenerator('90 #000000 #ffffff')).toBe('linear-gradient(90deg, #000000, #ffffff)');
    expect(gradientGenerator('90deg #fff #000')).toBe('linear-gradient(90deg, #ffffff, #000000)');
    expect(parseGradient('45 #abc #123456')?.css).toBe('linear-gradient(45deg, #aabbcc, #123456)');
  });

  it('rejects a missing color', () => {
    expect(() => gradientGenerator('90 #ffffff')).toThrow(ToolInputError);
    expect(() => gradientGenerator('sideways red blue')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(gradientGenerator(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(gradientGenerator, { malformed: ['90', '#fff', '90 red blue'] });
  });
});
