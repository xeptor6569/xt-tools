import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export type ImageFormat = 'png' | 'jpeg' | 'webp';

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

const FORMAT = /^(png|jpeg|jpg|webp)$/i;

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
  if (formatAt < 0) throw new ToolInputError('Name a format: png, jpeg or webp.');
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
