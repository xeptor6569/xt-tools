import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import jsQR from 'jsqr';
import { NO_QR, qrReader } from './logic.ts';

describe('qrReader', () => {
  it('returns decoded text and a clear miss', () => {
    expect(qrReader('  hello  ')).toBe('hello');
    expect(qrReader('')).toBe(NO_QR);
    expect(qrReader('   ')).toBe(NO_QR);
  });

  it('decodes a QR raster with jsqr', () => {
    const qr = encode('hello xt', { ecc: 'M', border: 4 });
    const scale = 4;
    const size = qr.size * scale;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < qr.size; y++) {
      const row = qr.data[y];
      if (!row) continue;
      for (let x = 0; x < qr.size; x++) {
        const dark = row[x];
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const i = ((y * scale + dy) * size + (x * scale + dx)) * 4;
            const value = dark ? 0 : 255;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
            data[i + 3] = 255;
          }
        }
      }
    }
    expect(jsQR(data, size, size)?.data).toBe('hello xt');
  });

  it('rejects an enormous payload', () => {
    expect(() => qrReader('x'.repeat(100_001))).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(qrReader);
  });
});
