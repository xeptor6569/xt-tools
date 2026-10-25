import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { decodeGeohash, encodeGeohash, geoConverter } from './logic.ts';
import meta from './meta.ts';

describe('geoConverter', () => {
  it('encodes the classic geohash vector', () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
    const cell = decodeGeohash('u4pruydqqvj');
    expect(cell.latMin).toBeLessThanOrEqual(57.64911);
    expect(cell.latMax).toBeGreaterThanOrEqual(57.64911);
    expect(cell.lonMin).toBeLessThanOrEqual(10.40744);
    expect(cell.lonMax).toBeGreaterThanOrEqual(10.40744);
    expect(cell.lat).toBeCloseTo(57.64911, 5);
    expect(cell.lon).toBeCloseTo(10.40744, 5);
  });

  it('round-trips 9.999, -9.999 and the Wikipedia ezs42 cell', () => {
    const hash = encodeGeohash(9.999, -9.999, 12);
    expect(hash).toBe('ecbbukqbqktn');
    const cell = decodeGeohash(hash);
    expect(cell.latMin).toBeLessThanOrEqual(9.999);
    expect(cell.latMax).toBeGreaterThanOrEqual(9.999);
    expect(cell.lonMin).toBeLessThanOrEqual(-9.999);
    expect(cell.lonMax).toBeGreaterThanOrEqual(-9.999);
    expect(encodeGeohash(42.6, -5.6, 5)).toBe('ezs42');
  });

  it('converts decimal degrees to DMS and geohash', () => {
    const output = geoConverter('48.8584, 2.2945');
    expect(output).toContain('48°51\'30.24"N');
    expect(output).toContain('2°17\'40.20"E');
    expect(output).toContain('u09tunquc9z');
    expect(geoConverter('57.64911, 10.40744')).toContain('u4pruydqqvj');
  });

  it('converts DMS and geohash back to decimal degrees', () => {
    const fromDms = geoConverter(`48°51'30.24"N 2°17'40.20"E`);
    expect(fromDms).toContain('48.8584');
    expect(fromDms).toContain('2.2945');
    const fromHash = geoConverter('u4pruydqqvj');
    expect(fromHash).toContain('Geohash: u4pruydqqvj');
    expect(fromHash).toContain('57.64911');
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => geoConverter('91, 0')).toThrow(ToolInputError);
    expect(() => geoConverter('0, 181')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(geoConverter(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(geoConverter, { malformed: ['hello', '91, 0', 'u4pruyl'] });
  });
});
