import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { benchmarkBuilder } from './logic.ts';

describe('benchmarkBuilder', () => {
  it('sorts fastest first and compares with the best', () => {
    expect(benchmarkBuilder('parse 20\nrender 10')).toBe(['1. render  10  1×  fastest', '2. parse  20  2×'].join('\n'));
  });

  it('does not execute names and rejects negative values', () => {
    expect(benchmarkBuilder('alert(1) 5\nconsole.log(2) 10')).toContain('1. alert(1)');
    expect(() => benchmarkBuilder('bad -1')).toThrow(ToolInputError);
    const zeros = benchmarkBuilder('a 0\nb 10');
    expect(zeros).toContain('1. a  0  1×  fastest');
    expect(zeros).toContain('n/a');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(benchmarkBuilder);
  });
});
