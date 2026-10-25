import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { fitImage, imageConverter } from './logic.ts';
import meta from './meta.ts';

describe('imageConverter', () => {
  it('scales a known source down to the max width', () => {
    expect(imageConverter('1600 900 800 jpeg 0.8')).toBe('800×450 jpeg q=0.80');
  });

  it('does not upscale and applies a crop before scaling', () => {
    expect(imageConverter('100 50 800 png 1')).toBe('100×50 png q=1.00');
    expect(imageConverter('100 80 50 png 1 10 5 40 20')).toBe('40×20 png q=1.00 crop 10,5 40×20');
    expect(fitImage(100, 50, 30)).toEqual({ sx: 0, sy: 0, sw: 100, sh: 50, dw: 30, dh: 15 });
  });

  it('describes settings when the source size is unknown', () => {
    expect(imageConverter('800 webp 0.5')).toBe('max 800 webp q=0.50');
    expect(imageConverter('')).toBe('');
  });

  it('rejects a crop that leaves the image and a bad format', () => {
    expect(() => imageConverter('100 80 50 png 1 90 0 40 20')).toThrow(/Crop is outside/);
    expect(() => imageConverter('hello')).toThrow(ToolInputError);
    expect(() => imageConverter('800 jpeg 0')).toThrow(ToolInputError);
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(imageConverter(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(imageConverter);
  });
});
