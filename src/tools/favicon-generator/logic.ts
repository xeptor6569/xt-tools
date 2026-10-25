import { ToolInputError } from '../types.ts';

const HEX = /^#[0-9a-fA-F]{6}$/;

export interface FaviconSpec {
  letter: string;
  background: string;
  foreground: string;
}

export interface PngImage {
  size: number;
  png: Uint8Array;
}

/** First letter, plus optional `#RRGGBB` background and foreground. */
export function parseFavicon(input: string): FaviconSpec | undefined {
  if (input.length > 10_000) throw new ToolInputError('Enter a letter, not a long document.');
  const trimmed = input.trim();
  if (trimmed === '') return undefined;
  const parts = trimmed.split(/\s+/);
  const letter = Array.from(parts[0] ?? '')[0];
  if (!letter) return undefined;
  const background = parts[1] && HEX.test(parts[1]) ? parts[1] : '#1d4ed8';
  const foreground = parts[2] && HEX.test(parts[2]) ? parts[2] : '#ffffff';
  return { letter: letter.toLocaleUpperCase('en'), background, foreground };
}

/** Text shown next to the canvas. Deterministic, so an example can check it. */
export function describeFavicon(input: string): string {
  const spec = parseFavicon(input);
  if (!spec) return '';
  return `Letter favicon: ${spec.letter}`;
}

/** Wrap PNG files in an ICO (PNG-in-ICO). Sizes are 1–256; 256 is stored as 0. */
export function pngsToIco(images: readonly PngImage[]): Uint8Array {
  if (images.length < 1 || images.length > 10) throw new ToolInputError('An ICO needs between 1 and 10 images.');
  const header = 6 + images.length * 16;
  const total = header + images.reduce((sum, image) => sum + image.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);
  let entry = 6;
  let offset = header;
  for (const image of images) {
    if (!Number.isInteger(image.size) || image.size < 1 || image.size > 256) {
      throw new ToolInputError('Icon size must be from 1 to 256.');
    }
    if (image.png.length === 0) throw new ToolInputError('A PNG image was empty.');
    const dim = image.size === 256 ? 0 : image.size;
    out[entry] = dim;
    out[entry + 1] = dim;
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, image.png.length, true);
    view.setUint32(entry + 12, offset, true);
    out.set(image.png, offset);
    offset += image.png.length;
    entry += 16;
  }
  return out;
}
