import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { matrixCalculator } from './logic.ts';

describe('matrixCalculator', () => {
  it('adds, multiplies, transposes, and takes a determinant', () => {
    expect(matrixCalculator('det\n1 2\n3 4')).toBe('-2');
    expect(matrixCalculator('add\n1 2\n3 4\n\n5 6\n7 8')).toBe('6 8\n10 12');
    expect(matrixCalculator('mul\n1 2\n3 4\n\n5 6\n7 8')).toBe('19 22\n43 50');
    expect(matrixCalculator('transpose\n1 2 3\n4 5 6')).toBe('1 4\n2 5\n3 6');
  });

  it('inverts with exact fractions', () => {
    expect(matrixCalculator('inv\n1 2\n3 4')).toBe('-2 1\n3/2 -1/2');
    expect(matrixCalculator('inv\n4')).toBe('1/4');
    expect(() => matrixCalculator('inv\n1 2\n2 4')).toThrow(ToolInputError);
  });

  it('rejects matrices larger than 8', () => {
    const row = Array.from({ length: 9 }, () => '1').join(' ');
    expect(() => matrixCalculator(`det\n${row}`)).toThrow(ToolInputError);
    expect(() => matrixCalculator('add\n1 2')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(matrixCalculator);
  });
});
