import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { mathEvaluator } from './logic.ts';

describe('mathEvaluator', () => {
  it('evaluates arithmetic without running code', () => {
    expect(mathEvaluator('1+2*3')).toBe('7');
    expect(mathEvaluator('(1+2)*3')).toBe('9');
    expect(mathEvaluator('sin(90)')).toBe('1');
    expect(mathEvaluator('log(100)')).toBe('2');
    expect(mathEvaluator('2^10')).toBe('1024');
  });

  it('rejects unknown identifiers', () => {
    expect(() => mathEvaluator('width')).toThrow(ToolInputError);
    expect(() => mathEvaluator('1/0')).toThrow(ToolInputError);
  });

  it('returns nothing for empty input and caps the length', () => {
    expect(mathEvaluator('')).toBe('');
    expect(mathEvaluator('   ')).toBe('');
    expect(() => mathEvaluator('1'.repeat(20_000))).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(mathEvaluator);
  });
});
