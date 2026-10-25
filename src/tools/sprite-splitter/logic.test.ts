import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { frameRects, spriteSplitter } from './logic.ts';
import meta from './meta.ts';

describe('spriteSplitter', () => {
  it('splits an even grid', () => {
    expect(spriteSplitter('2 2 100 80')).toBe(
      ['frame 0: 0,0 50×40', 'frame 1: 50,0 50×40', 'frame 2: 0,40 50×40', 'frame 3: 50,40 50×40'].join('\n'),
    );
  });

  it('gives leftover pixels to the last column and row', () => {
    const frames = frameRects(3, 1, 100, 10);
    expect(frames.map((frame) => frame.w)).toEqual([33, 33, 34]);
    expect(frames.reduce((sum, frame) => sum + frame.w, 0)).toBe(100);
  });

  it('asks for a size when only the grid is given', () => {
    expect(() => spriteSplitter('2 2')).toThrow(/width and height/);
    expect(() => spriteSplitter('hello')).toThrow(ToolInputError);
    expect(spriteSplitter('')).toBe('');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(spriteSplitter(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(spriteSplitter);
  });
});
