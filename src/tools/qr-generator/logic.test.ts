import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { qrGenerator, qrSvg } from './logic.ts';

/** Paints the path back onto a grid to check it covers exactly the dark modules. */
function rasterize(path: string, size: number): boolean[][] {
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (const [, x, y, w] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i++) grid[Number(y)]![Number(x) + i] = true;
  }
  return grid;
}

describe('qrGenerator', () => {
  it('encodes a URL as a version-3 code with a 4-module border', () => {
    const qr = qrGenerator('https://example.com/some/path', 'M');
    expect(qr?.version).toBe(3);
    expect(qr?.size).toBe(29 + 8);
  });

  it('draws exactly the dark modules', () => {
    for (const text of ['hello', 'HELLO WORLD 123', 'Ünïcödé 🚀', 'x'.repeat(500)]) {
      const qr = qrGenerator(text, 'Q', 2);
      const expected = encode(text, { ecc: 'Q', border: 2 }).data;
      expect(rasterize(qr!.path, qr!.size)).toEqual(expected);
    }
  });

  it('uses larger codes for higher error correction', () => {
    const text = 'x'.repeat(100);
    expect(qrGenerator(text, 'H')!.version).toBeGreaterThan(qrGenerator(text, 'L')!.version);
  });

  it('returns nothing for empty input and refuses too much data', () => {
    expect(qrGenerator('')).toBeUndefined();
    expect(() => qrGenerator('x'.repeat(5000))).toThrow(ToolInputError);
    expect(() => qrGenerator('漢'.repeat(1500), 'H')).toThrow(/Too much data/);
  });

  it('builds a standalone SVG and sanitises colours', () => {
    const svg = qrSvg(qrGenerator('hi')!, '#112233', 'red" onload="x');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('fill="#112233"');
    expect(svg).not.toContain('onload');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => qrGenerator(s), { timeLimitMs: 4000 });
  });
});
