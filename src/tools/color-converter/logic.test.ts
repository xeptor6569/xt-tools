import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { colorConverter } from './logic.ts';

const as = (input: string) => Object.fromEntries(colorConverter(input)?.formats.map((f) => [f.label, f.value]) ?? []);

describe('colorConverter', () => {
  it('converts a named color to every format', () => {
    expect(as('rebeccapurple')).toEqual({
      HEX: '#663399',
      RGB: 'rgb(102, 51, 153)',
      HSL: 'hsl(270, 50%, 40%)',
      HWB: 'hwb(270 20% 40%)',
      Lab: 'lab(32.39% 38.42 -47.69)',
      LCH: 'lch(32.39% 61.24 308.86)',
      OKLab: 'oklab(0.4403 0.0882 -0.1339)',
      OKLCH: 'oklch(0.4403 0.1603 303.37)',
      'CSS name': 'rebeccapurple',
    });
  });

  it('accepts hex with and without #, short and with alpha', () => {
    expect(as('fff').HEX).toBe('#ffffff');
    expect(as('#F00').RGB).toBe('rgb(255, 0, 0)');
    expect(as('#ff000080').HEX).toBe('#ff000080');
    expect(as('#ff000080').RGB).toBe('rgba(255, 0, 0, 0.5)');
    expect(as('#ff000080').OKLCH).toMatch(/ \/ 0\.502\)$/);
  });

  it('parses modern CSS syntax', () => {
    expect(as('rgb(0 128 255)').HEX).toBe('#0080ff');
    expect(as('hsl(120deg 100% 25%)').HEX).toBe('#008000');
    expect(as('oklch(0.6279 0.2577 29.23)').HEX).toBe('#ff0000');
  });

  it('flags and clamps colors outside sRGB', () => {
    const result = colorConverter('color(display-p3 1 0 0)');
    expect(result?.inGamut).toBe(false);
    expect(result?.formats[0]?.note).toMatch(/Outside sRGB/);
    expect(result?.formats[0]?.value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('returns nothing for empty input and explains bad input', () => {
    expect(colorConverter('  ')).toBeUndefined();
    expect(() => colorConverter('not-a-color')).toThrow(ToolInputError);
    expect(() => colorConverter('#12345')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(colorConverter, { malformed: ['rgb(', 'hsl(nan, 1, 1)', 'oklch(1 1 1 / 2)', 'color(foo 1 2 3)'] });
  });
});
