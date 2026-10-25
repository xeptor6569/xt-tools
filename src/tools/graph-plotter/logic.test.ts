import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { graphPlotter, plotFunction } from './logic.ts';

describe('graphPlotter', () => {
  it('samples y = x, including zero', () => {
    const text = graphPlotter('x');
    expect(text).toContain('0 → 0');
    expect(text).toContain('-2 → -2');
    expect(text).toContain('2 → 2');
    const plot = plotFunction('x');
    expect(plot.samples.length).toBeGreaterThan(10);
    const atZero = plot.samples.find((point) => Math.abs(point.x) < 1e-9);
    expect(atZero?.y).toBeCloseTo(0, 9);
  });

  it('leaves a gap where the expression is undefined', () => {
    expect(graphPlotter('1/x')).toContain('0 → undefined');
    expect(graphPlotter('1/x')).toContain('1 → 1');
    expect(() => graphPlotter('y')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(graphPlotter);
  });
});
