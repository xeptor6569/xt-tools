import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { convert, format, unitConverter } from './logic.ts';
import { CATEGORIES } from './units.ts';

const as = (v: string, c: string, from: string) =>
  Object.fromEntries(unitConverter(v, c, from).map((x) => [x.label, x.value]));

describe('unitConverter', () => {
  it('length', () => {
    expect(convert(1, 'length', 'mi', 'km')).toBeCloseTo(1.609344, 12);
    expect(convert(12, 'length', 'in', 'ft')).toBeCloseTo(1, 12);
    expect(as('1', 'length', 'm')['Feet (ft)']).toBe('3.28083989501');
  });

  it('temperature', () => {
    expect(convert(100, 'temperature', 'c', 'f')).toBeCloseTo(212, 10);
    expect(convert(-40, 'temperature', 'f', 'c')).toBeCloseTo(-40, 10);
    expect(convert(0, 'temperature', 'k', 'c')).toBeCloseTo(-273.15, 10);
    expect(convert(491.67, 'temperature', 'r', 'c')).toBeCloseTo(0, 10);
    expect(() => convert(-300, 'temperature', 'c', 'k')).toThrow(/absolute zero/);
  });

  it('distinguishes decimal and binary data sizes', () => {
    const r = as('1', 'data', 'GB');
    expect(r['Mebibytes (MiB)']).toBe('953.674316406');
    expect(r['Megabytes (MB)']).toBe('1,000');
    expect(as('1', 'data', 'GiB')['Bytes (B)']).toBe('1,073,741,824');
    expect(as('1', 'data', 'Gbit')['Megabytes (MB)']).toBe('125');
  });

  it('cooking and US/UK volumes', () => {
    expect(convert(1, 'volume', 'gal-us', 'l')).toBeCloseTo(3.785411784, 12);
    expect(convert(1, 'volume', 'cup-us', 'tbsp')).toBeCloseTo(16, 10);
    expect(convert(1, 'volume', 'gal-uk', 'pt-uk')).toBeCloseTo(8, 10);
  });

  it('every unit converts to itself and back', () => {
    for (const c of CATEGORIES) {
      for (const a of c.units) {
        for (const b of c.units) {
          expect(convert(convert(42, c.id, a.id, b.id), c.id, b.id, a.id), `${c.id} ${a.id}→${b.id}`).toBeCloseTo(
            42,
            6,
          );
        }
      }
    }
  });

  it('formats numbers readably', () => {
    expect(format(0.1 + 0.2)).toBe('0.3');
    expect(format(1234567.891)).toBe('1,234,567.891');
    expect(format(9.4607304725808e15)).toBe('9.460730473e+15');
    expect(format(1.602176634e-19)).toBe('1.602176634e-19');
  });

  it('rejects text that is not a number', () => {
    expect(() => unitConverter('abc', 'length', 'm')).toThrow(ToolInputError);
    expect(() => unitConverter('1e400', 'length', 'm')).toThrow(/too large/);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => unitConverter(s, 'length', 'm'));
  });
});
