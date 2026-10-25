import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { formatNumber } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';
import { statistics } from './logic.ts';

describe('statistics', () => {
  it('summarizes a small sample with Tukey quartiles', () => {
    expect(statistics('1, 2, 3, 4, 5')).toBe(
      [
        'Count: 5',
        'Min: 1',
        'Max: 5',
        'Sum: 15',
        'Mean: 3',
        'Median: 3',
        'Sample standard deviation: 1.58113883008',
        'Q1: 1.5',
        'Q2: 3',
        'Q3: 4.5',
      ].join('\n'),
    );
  });

  it('accepts whitespace and reports the sample standard deviation', () => {
    const text = statistics('2 4 4 4 5 5 7 9');
    expect(text).toContain('Count: 8');
    expect(text).toContain('Mean: 5');
    expect(text).toContain('Median: 4.5');
    expect(text).toContain('Q1: 4');
    expect(text).toContain('Q3: 6');
    expect(text).toContain(`Sample standard deviation: ${formatNumber(Math.sqrt(32 / 7))}`);
  });

  it('has no sample deviation for a single value', () => {
    expect(statistics('4')).toContain('Sample standard deviation: n/a');
    expect(statistics('4')).toContain('Median: 4');
  });

  it('rejects text that is not a number', () => {
    expect(() => statistics('1, two')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(statistics);
  });
});
