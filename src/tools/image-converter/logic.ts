import avifEnc from '@jsquash/avif/codec/enc/avif_enc.js';
import { defaultOptions as avifDefaults } from '@jsquash/avif/meta.js';
import { initEmscriptenModule as initAvifEm } from '@jsquash/avif/utils.js';
import jpegEncode, { init as initJpeg } from '@jsquash/jpeg/encode.js';
import initOxi, { optimise as oxiOptimise } from '@jsquash/oxipng/codec/pkg/squoosh_oxipng.js';
import pngEncode, { init as initPng } from '@jsquash/png/encode.js';
import webpEncSimd from '@jsquash/webp/codec/enc/webp_enc_simd.js';
import { defaultOptions as webpDefaults } from '@jsquash/webp/meta.js';
import { initEmscriptenModule as initWebpEm } from '@jsquash/webp/utils.js';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif';
export type WasmCodecId = 'png' | 'oxipng' | 'jpeg' | 'webp' | 'avif';

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageSpec {
  sourceW?: number;
  sourceH?: number;
  maxWidth: number;
  format: ImageFormat;
  quality: number;
  crop?: Crop;
}

export interface Fitted {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dw: number;
  dh: number;
}

const FORMAT = /^(png|jpeg|jpg|webp|avif)$/i;

/**
 * `1600 900 800 jpeg 0.8` or `800 jpeg 0.8`, with an optional crop `x y w h`.
 * The summary is the output size when the source size is known.
 */
export function imageConverter(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return '';
  return describeImage(parseImageSpec(input));
}

export function parseImageSpec(input: string): ImageSpec {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new ToolInputError('Enter a max width, format and quality.');
  const formatAt = tokens.findIndex((token) => FORMAT.test(token));
  if (formatAt < 0) throw new ToolInputError('Name a format: png, jpeg, webp or avif.');
  let sourceW: number | undefined;
  let sourceH: number | undefined;
  let maxAt: number;
  if (formatAt === 1) maxAt = 0;
  else if (formatAt === 3) {
    sourceW = whole(tokens[0] ?? '', 'Width', 1, 16384);
    sourceH = whole(tokens[1] ?? '', 'Height', 1, 16384);
    maxAt = 2;
  } else throw new ToolInputError('Use "800 jpeg 0.8" or "1600 900 800 jpeg 0.8".');

  const maxWidth = whole(tokens[maxAt] ?? '', 'Max width', 1, 8192);
  const rawFormat = (tokens[formatAt] ?? '').toLowerCase();
  const format: ImageFormat = rawFormat === 'jpg' ? 'jpeg' : (rawFormat as ImageFormat);
  const quality = qualityOf(tokens[formatAt + 1] ?? '');
  const rest = tokens.slice(formatAt + 2);
  let crop: Crop | undefined;
  if (rest.length === 4) {
    crop = {
      x: whole(rest[0] ?? '', 'Crop x', 0, 16384),
      y: whole(rest[1] ?? '', 'Crop y', 0, 16384),
      w: whole(rest[2] ?? '', 'Crop width', 1, 16384),
      h: whole(rest[3] ?? '', 'Crop height', 1, 16384),
    };
  } else if (rest.length !== 0) {
    throw new ToolInputError('Crop is four numbers: x y width height.');
  }
  return {
    ...(sourceW !== undefined && sourceH !== undefined ? { sourceW, sourceH } : {}),
    maxWidth,
    format,
    quality,
    ...(crop ? { crop } : {}),
  };
}

/** Crop (if any) then scale down so the width is at most `maxWidth`. Never upscales. */
export function fitImage(sourceW: number, sourceH: number, maxWidth: number, crop?: Crop): Fitted {
  if (sourceW < 1 || sourceH < 1 || maxWidth < 1) throw new ToolInputError('Image size is invalid.');
  let sx = 0;
  let sy = 0;
  let sw = sourceW;
  let sh = sourceH;
  if (crop) {
    if (
      crop.x < 0 ||
      crop.y < 0 ||
      crop.w < 1 ||
      crop.h < 1 ||
      crop.x + crop.w > sourceW ||
      crop.y + crop.h > sourceH
    ) {
      throw new ToolInputError('Crop is outside the image.');
    }
    sx = crop.x;
    sy = crop.y;
    sw = crop.w;
    sh = crop.h;
  }
  const dw = Math.max(1, Math.min(maxWidth, sw));
  const dh = Math.max(1, Math.round((sh * dw) / sw));
  return { sx, sy, sw, sh, dw, dh };
}

export function describeImage(spec: ImageSpec): string {
  const q = spec.quality.toFixed(2);
  let size = `max ${spec.maxWidth}`;
  if (spec.sourceW !== undefined && spec.sourceH !== undefined) {
    const fit = fitImage(spec.sourceW, spec.sourceH, spec.maxWidth, spec.crop);
    size = `${fit.dw}×${fit.dh}`;
  }
  const crop = spec.crop ? ` crop ${spec.crop.x},${spec.crop.y} ${spec.crop.w}×${spec.crop.h}` : '';
  return `${size} ${spec.format} q=${q}${crop}`;
}

export function formatImageSpec(spec: ImageSpec): string {
  const source = spec.sourceW !== undefined && spec.sourceH !== undefined ? `${spec.sourceW} ${spec.sourceH} ` : '';
  const crop = spec.crop ? ` ${spec.crop.x} ${spec.crop.y} ${spec.crop.w} ${spec.crop.h}` : '';
  return `${source}${spec.maxWidth} ${spec.format} ${spec.quality}${crop}`;
}

export function mimeFor(format: ImageFormat): string {
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  if (format === 'avif') return 'image/avif';
  return 'image/jpeg';
}

function whole(token: string, label: string, min: number, max: number): number {
  if (!/^\d+$/.test(token)) throw new ToolInputError(`${label} must be a whole number.`);
  const value = Number(token);
  if (value < min || value > max) throw new ToolInputError(`${label} must be from ${min} to ${max}.`);
  return value;
}

function qualityOf(token: string): number {
  if (token === '') throw new ToolInputError('Add a quality from 0.01 to 1, or 1 to 100.');
  let quality = Number(token);
  if (quality > 1 && quality <= 100) quality /= 100;
  if (!Number.isFinite(quality) || quality <= 0 || quality > 1) {
    throw new ToolInputError('Quality must be greater than 0 and at most 1 (or 1–100).');
  }
  return quality;
}

let pngReady: Promise<unknown> | undefined;
let oxiReady: Promise<unknown> | undefined;
let jpegReady: Promise<unknown> | undefined;
let webpReady:
  Promise<{ encode: (d: Uint8ClampedArray, w: number, h: number, o: unknown) => Uint8Array | null }> | undefined;
let avifReady: Promise<{ encode: (d: Uint8Array, w: number, h: number, o: unknown) => Uint8Array | null }> | undefined;

/**
 * Encodes RGBA pixel data using WebAssembly codecs:
 * - PNG: @jsquash/png + @jsquash/oxipng lossless optimizer
 * - JPEG: @jsquash/jpeg (MozJPEG)
 * - WebP: @jsquash/webp (libwebp SIMD)
 * - AVIF: @jsquash/avif (libavif)
 */
export async function encodeRgbaWithWasm(
  rgbaInput: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  format: ImageFormat,
  quality: number,
  loadWasm: (codec: WasmCodecId) => Promise<WebAssembly.Module>,
): Promise<Uint8Array> {
  if (width < 1 || height < 1 || rgbaInput.length < width * height * 4) {
    throw new ToolInputError('RGBA pixel buffer does not match width × height × 4.');
  }
  const copy = new Uint8ClampedArray(width * height * 4);
  copy.set(rgbaInput.subarray(0, width * height * 4));
  const q100 = Math.max(1, Math.min(100, Math.round(quality * 100)));

  if (format === 'png') {
    pngReady ??= loadWasm('png').then((m) => initPng(m));
    oxiReady ??= loadWasm('oxipng').then((m) => initOxi(m));
    await Promise.all([pngReady, oxiReady]);
    const raw = new Uint8Array(await pngEncode({ width, height, data: copy, colorSpace: 'srgb' }));
    const level = q100 >= 90 ? 3 : 2;
    return new Uint8Array(oxiOptimise(raw, level, false, true));
  }

  if (format === 'jpeg') {
    jpegReady ??= loadWasm('jpeg').then((m) => initJpeg(m));
    await jpegReady;
    const buf = await jpegEncode({ width, height, data: copy, colorSpace: 'srgb' }, { quality: q100 });
    return new Uint8Array(buf);
  }

  if (format === 'webp') {
    webpReady ??= loadWasm('webp').then((m) => initWebpEm(webpEncSimd, m));
    const mod = await webpReady;
    const res = mod.encode(copy, width, height, { ...webpDefaults, quality: q100 });
    if (!res) throw new ToolInputError('WebP WASM encoder failed.');
    return new Uint8Array(res);
  }

  avifReady ??= loadWasm('avif').then((m) => initAvifEm(avifEnc, m));
  const mod = await avifReady;
  const res = mod.encode(new Uint8Array(copy.buffer, copy.byteOffset, copy.byteLength), width, height, {
    ...avifDefaults,
    quality: q100,
  });
  if (!res) throw new ToolInputError('AVIF WASM encoder failed.');
  return new Uint8Array(res);
}
