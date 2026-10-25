import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { paletteExtractor, quantizePalette } from './logic.ts';
import meta from './meta.ts';

describe('paletteExtractor', () => {
  it('keeps the most common colors from a buffer', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 255, 0, 0, 0, 0]);
    expect(quantizePalette(rgba, 2)).toEqual(['#ff0000', '#0000ff']);
    expect(quantizePalette(new Uint8ClampedArray([0, 0, 0, 0]), 3)).toEqual([]);
  });

  it('quantizes hex pixels from a line of text', () => {
    expect(paletteExtractor('2 ff0000 ff0000 0000ff')).toBe('#ff0000\n#0000ff');
    expect(paletteExtractor('5')).toBe('');
    expect(paletteExtractor('')).toBe('');
  });

  it('rejects a bad token and an odd buffer', () => {
    expect(() => paletteExtractor('2 hello')).toThrow(ToolInputError);
    expect(() => quantizePalette(new Uint8ClampedArray([1, 2, 3]), 2)).toThrow(ToolInputError);
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(paletteExtractor(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(paletteExtractor);
  });
});
