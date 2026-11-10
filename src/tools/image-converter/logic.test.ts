import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { encodeRgbaWithWasm, fitImage, imageConverter, type WasmCodecId } from './logic.ts';
import meta from './meta.ts';

const WASM_FILES: Record<WasmCodecId, string> = {
  png: 'node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm',
  oxipng: 'node_modules/@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm',
  jpeg: 'node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm',
  webp: 'node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm',
  avif: 'node_modules/@jsquash/avif/codec/enc/avif_enc.wasm',
};

const loadNodeWasm = async (codec: WasmCodecId) => WebAssembly.compile(readFileSync(WASM_FILES[codec]));

describe('imageConverter', () => {
  it('scales a known source down to the max width', () => {
    expect(imageConverter('1600 900 800 jpeg 0.8')).toBe('800×450 jpeg q=0.80');
    expect(imageConverter('1600 900 800 avif 0.75')).toBe('800×450 avif q=0.75');
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

  it('encodes RGBA pixels with OxiPNG, MozJPEG, libwebp and libavif WASM codecs', async () => {
    const rgba = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < 8 * 8; i++) {
      rgba[i * 4] = 29;
      rgba[i * 4 + 1] = 78;
      rgba[i * 4 + 2] = 216;
      rgba[i * 4 + 3] = 255;
    }
    const png = await encodeRgbaWithWasm(rgba, 8, 8, 'png', 0.9, loadNodeWasm);
    expect(Array.from(png.slice(0, 4))).toEqual([137, 80, 78, 71]);

    const jpeg = await encodeRgbaWithWasm(rgba, 8, 8, 'jpeg', 0.8, loadNodeWasm);
    expect(Array.from(jpeg.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);

    const webp = await encodeRgbaWithWasm(rgba, 8, 8, 'webp', 0.8, loadNodeWasm);
    expect(new TextDecoder('ascii').decode(webp.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder('ascii').decode(webp.subarray(8, 12))).toBe('WEBP');

    const avif = await encodeRgbaWithWasm(rgba, 8, 8, 'avif', 0.8, loadNodeWasm);
    expect(new TextDecoder('ascii').decode(avif.subarray(4, 12))).toBe('ftypavif');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(imageConverter(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(imageConverter);
  });
});
