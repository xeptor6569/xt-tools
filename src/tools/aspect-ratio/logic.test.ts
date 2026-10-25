import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { aspectRatio } from './logic.ts';
import meta from './meta.ts';

describe('aspectRatio', () => {
  it('simplifies two sides', () => {
    expect(aspectRatio('1920 1080')).toBe('16:9\nwidth 1920\nheight 1080');
    expect(aspectRatio('1920x1080')).toContain('16:9');
  });

  it('fills in the missing side', () => {
    expect(aspectRatio('16:9 width 1280')).toBe('16:9\nwidth 1280\nheight 720');
    expect(aspectRatio('16:9 height 720')).toBe('16:9\nwidth 1280\nheight 720');
    expect(aspectRatio('16:9 width 1000')).toContain('height 562.5');
  });

  it('rejects empty dimensions and unknown text', () => {
    expect(aspectRatio('')).toBe('');
    expect(() => aspectRatio('16:9 width 0')).toThrow(ToolInputError);
    expect(() => aspectRatio('hello')).toThrow(ToolInputError);
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(aspectRatio(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(aspectRatio);
  });
});
