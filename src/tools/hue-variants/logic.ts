import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export const HUE_DEGREES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const;

export interface HueStop {
  deg: number;
  hex: string;
}

/** Rotates every opaque-or-not pixel's hue. Alpha is copied. */
export function rotateHue(rgba: Uint8ClampedArray, degrees: number): Uint8ClampedArray {
  if (rgba.length % 4 !== 0) throw new ToolInputError('Pixel buffer length must be a multiple of 4.');
  const out = new Uint8ClampedArray(rgba.length);
  const turn = (((degrees % 360) + 360) % 360) / 360;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const a = rgba[i + 3] ?? 0;
    const [nr, ng, nb] = turn === 0 ? [r, g, b] : rotateRgb(r, g, b, turn);
    out[i] = nr;
    out[i + 1] = ng;
    out[i + 2] = nb;
    out[i + 3] = a;
  }
  return out;
}

/** `#ff0000`, `ff0000`, `#f00` or `255 0 0` → one line per 30° step. */
export function hueVariants(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return '';
  return hueStops(input)
    .map((stop) => `${stop.deg}° ${stop.hex}`)
    .join('\n');
}

export function hueStops(input: string): HueStop[] {
  const [r, g, b] = parseColor(input.trim());
  return HUE_DEGREES.map((deg) => {
    const [nr, ng, nb] = deg === 0 ? [r, g, b] : rotateRgb(r, g, b, deg / 360);
    return { deg, hex: rgbHex(nr, ng, nb) };
  });
}

export function rotateRgb(r: number, g: number, b: number, turn: number): [number, number, number] {
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb((h + turn) % 1, s, l);
}

function parseColor(text: string): [number, number, number] {
  const channels = text.split(/\s+/);
  if (channels.length === 3 && channels.every((part) => /^\d{1,3}$/.test(part))) {
    const rgb = channels.map((part) => Number(part));
    if (rgb.some((value) => value > 255)) throw new ToolInputError('RGB channels must be 0–255.');
    return [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0];
  }
  const raw = text.replace(/^#/, '');
  const hex = raw.length === 3 ? [...raw].map((ch) => ch + ch).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    throw new ToolInputError('Use #rrggbb, #rgb or "R G B".');
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export function rgbHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
  else if (max === gf) h = (bf - rf) / d + 2;
  else h = (rf - gf) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [channel(p, q, h + 1 / 3), channel(p, q, h), channel(p, q, h - 1 / 3)];
}

function channel(p: number, q: number, t: number): number {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return Math.round((p + (q - p) * 6 * x) * 255);
  if (x < 1 / 2) return Math.round(q * 255);
  if (x < 2 / 3) return Math.round((p + (q - p) * (2 / 3 - x) * 6) * 255);
  return Math.round(p * 255);
}
