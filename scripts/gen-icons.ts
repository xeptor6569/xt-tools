// Draws the PWA icons from the same mark as public/favicon.svg. Run with
// `node scripts/gen-icons.ts` after changing that mark. The PNGs are committed
// so the site never fetches an icon at build or runtime.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
import { ROOT } from './lib/tools.ts';

const BLUE = [29, 78, 216] as const;
const WHITE = [255, 255, 255] as const;

type Rgba = readonly [number, number, number, number];

function crc32(data: Buffer): number {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

/** RGBA pixels, row by row, into a PNG. */
export function encodePng(size: number, rgba: Uint8Array): Buffer {
  if (rgba.length !== size * size * 4) throw new Error(`expected ${size * size * 4} bytes`);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(raw, row + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function pngSize(png: Buffer): { width: number; height: number } {
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG');
  if (png.subarray(12, 16).toString() !== 'IHDR') throw new Error('missing IHDR');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** The favicon chevron, in a 32-unit box scaled to `size` pixels. */
function onMark(x: number, y: number, size: number): boolean {
  const scale = size / 32;
  const radius = 1.5 * scale;
  const segments = [
    [9, 10, 15, 16],
    [15, 16, 9, 22],
    [17, 22, 24, 22],
  ] as const;
  return segments.some(
    ([x1, y1, x2, y2]) => distToSegment(x, y, x1 * scale, y1 * scale, x2 * scale, y2 * scale) <= radius,
  );
}

function insideRoundRect(x: number, y: number, size: number, radius: number): boolean {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  const nearLeft = x < radius;
  const nearRight = x >= size - radius;
  const nearTop = y < radius;
  const nearBottom = y >= size - radius;
  if (!(nearLeft || nearRight) || !(nearTop || nearBottom)) return true;
  const cx = nearLeft ? radius : size - radius;
  const cy = nearTop ? radius : size - radius;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function sample(x: number, y: number, size: number, maskable: boolean): Rgba {
  if (maskable) {
    // Keep the mark inside the center 80% so a circular mask does not clip it.
    const scale = 0.58;
    const origin = (size * (1 - scale)) / 2;
    const lx = (x - origin) / scale;
    const ly = (y - origin) / scale;
    if (lx >= 0 && ly >= 0 && lx < size && ly < size && onMark(lx, ly, size)) return [...WHITE, 255];
    return [...BLUE, 255];
  }
  if (!insideRoundRect(x, y, size, (7 / 32) * size)) return [0, 0, 0, 0];
  if (onMark(x, y, size)) return [...WHITE, 255];
  return [...BLUE, 255];
}

export function drawIcon(size: number, maskable: boolean): Buffer {
  const pixels = new Uint8Array(size * size * 4);
  const taps = [0.25, 0.75];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (const ox of taps) {
        for (const oy of taps) {
          const [r, g, b, a] = sample(x + ox, y + oy, size, maskable);
          red += r * a;
          green += g * a;
          blue += b * a;
          alpha += a;
        }
      }
      const i = (y * size + x) * 4;
      const samples = taps.length * taps.length;
      if (alpha === 0) continue;
      pixels[i] = Math.round(red / alpha);
      pixels[i + 1] = Math.round(green / alpha);
      pixels[i + 2] = Math.round(blue / alpha);
      pixels[i + 3] = Math.round(alpha / samples);
    }
  }
  return encodePng(size, pixels);
}

if (import.meta.main) {
  const dir = join(ROOT, 'public', 'icons');
  mkdirSync(dir, { recursive: true });
  const files = [
    ['icon-192.png', drawIcon(192, false)],
    ['icon-512.png', drawIcon(512, false)],
    ['icon-maskable-512.png', drawIcon(512, true)],
    ['apple-touch-icon.png', drawIcon(180, true)],
  ] as const;
  for (const [name, png] of files) {
    const { width, height } = pngSize(png);
    writeFileSync(join(dir, name), png);
    console.log(`  ${name} ${width}x${height}`);
  }
}
