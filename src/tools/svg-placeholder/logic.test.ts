import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import meta from './meta.ts';
import { svgPlaceholder } from './logic.ts';

describe('svgPlaceholder', () => {
  it('draws a sized SVG with the label', () => {
    const svg = svgPlaceholder('640 480 Hello');
    expect(svg).toContain('width="640"');
    expect(svg).toContain('height="480"');
    expect(svg).toContain('>Hello</text>');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it('escapes markup in the label', () => {
    const svg = svgPlaceholder('32 32 <script>alert(1)</script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('<script');
  });

  it('uses the size as the label when none is given', () => {
    expect(svgPlaceholder('10 20')).toContain('>10×20</text>');
  });

  it('rejects sizes outside 1–4096', () => {
    expect(() => svgPlaceholder('0 10 Hi')).toThrow(ToolInputError);
    expect(() => svgPlaceholder('nope')).toThrow(ToolInputError);
    expect(svgPlaceholder('')).toBe('');
    expect(svgPlaceholder('   ')).toBe('');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(svgPlaceholder(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(svgPlaceholder);
  });
});
