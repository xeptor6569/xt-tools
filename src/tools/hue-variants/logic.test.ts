import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { hueVariants, rotateHue } from './logic.ts';
import meta from './meta.ts';

describe('hueVariants', () => {
  it('rotates pure red in 30 degree steps', () => {
    const text = hueVariants('#ff0000');
    expect(text).toContain('0° #ff0000');
    expect(text).toContain('30° #ff8000');
    expect(text).toContain('60° #ffff00');
    expect(text).toContain('120° #00ff00');
    expect(text).toContain('240° #0000ff');
    expect(hueVariants('#f00')).toBe(text);
    expect(hueVariants('255 0 0')).toBe(text);
  });

  it('rotates a pixel buffer and keeps alpha', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 128, 0, 255, 0, 255]);
    const turned = rotateHue(rgba, 120);
    expect([...turned.slice(0, 4)]).toEqual([0, 255, 0, 128]);
    expect([...turned.slice(4)]).toEqual([0, 0, 255, 255]);
    expect([...rotateHue(rgba, 0)]).toEqual([...rgba]);
    expect([...rotateHue(rgba, 360)]).toEqual([...rgba]);
  });

  it('rejects a bad color and an odd buffer', () => {
    expect(() => hueVariants('hello')).toThrow(ToolInputError);
    expect(() => rotateHue(new Uint8ClampedArray([1, 2, 3]), 30)).toThrow(ToolInputError);
    expect(hueVariants('')).toBe('');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(hueVariants(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(hueVariants);
  });
});
