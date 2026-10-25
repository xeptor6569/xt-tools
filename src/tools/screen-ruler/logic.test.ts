import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { dpiFromMillimeters, screenRuler } from './logic.ts';

describe('screen ruler', () => {
  it('estimates DPI from millimetres over a CSS-pixel length', () => {
    expect(dpiFromMillimeters(96, 25.4)).toBe(96);
    expect(screenRuler('25.4 mm for 96 px')).toBe('96 DPI');
    expect(screenRuler('25.4 millimetres for 96 px')).toBe('96 DPI');
    expect(screenRuler('50 millimeters for 200 px')).toBe('101.6 DPI');
    expect(dpiFromMillimeters(200, 50)).toBeCloseTo(101.6, 10);
  });

  it('rejects a zero length', () => {
    expect(() => screenRuler('0 mm for 200 px')).toThrow(ToolInputError);
    expect(() => dpiFromMillimeters(0, 10)).toThrow(ToolInputError);
    expect(() => screenRuler('about this big')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(screenRuler);
  });
});
