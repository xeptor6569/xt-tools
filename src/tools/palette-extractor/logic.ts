import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_COLORS = 16;

/**
 * 5-bit-per-channel histogram. Returns the most common colors as `#rrggbb`,
 * most frequent first. Fully transparent pixels are ignored.
 */
export function quantizePalette(rgba: Uint8ClampedArray, count: number): string[] {
  if (count < 1 || count > MAX_COLORS) throw new ToolInputError(`Ask for 1 to ${MAX_COLORS} colors.`);
  if (rgba.length % 4 !== 0) throw new ToolInputError('Pixel buffer length must be a multiple of 4.');
  const counts = new Map<number, number>();
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) < 128) continue;
    const r = (rgba[i] ?? 0) >> 3;
    const g = (rgba[i + 1] ?? 0) >> 3;
    const b = (rgba[i + 2] ?? 0) >> 3;
    const key = (r << 10) | (g << 5) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, count)
    .map(([key]) => expandHex(key));
}

/**
 * `count #hex #hex …` quantizes those pixels. A lone count returns nothing
 * so a dropped image can use it. Example: `2 ff0000 0000ff`.
 */
export function paletteExtractor(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const text = input.trim();
  if (text === '') return '';
  const tokens = text.split(/\s+/);
  const first = tokens[0] ?? '';
  let count = 5;
  let colors = tokens;
  if (/^\d+$/.test(first)) {
    count = Number(first);
    colors = tokens.slice(1);
  }
  if (colors.length === 0) return '';
  if (colors.length > 100_000) throw new ToolInputError('Too many colors.');
  const rgba = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((token, index) => {
    const [r, g, b] = parseHex(token);
    rgba[index * 4] = r;
    rgba[index * 4 + 1] = g;
    rgba[index * 4 + 2] = b;
    rgba[index * 4 + 3] = 255;
  });
  const palette = quantizePalette(rgba, count);
  return palette.length === 0 ? 'No colors.' : palette.join('\n');
}

function parseHex(token: string): [number, number, number] {
  const raw = token.trim().replace(/^#/, '');
  const hex = raw.length === 3 ? [...raw].map((ch) => ch + ch).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new ToolInputError(`Not a hex color: ${token.slice(0, 32)}`);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function expandHex(key: number): string {
  const expand = (value: number) => (value << 3) | (value >> 2);
  const r = expand((key >> 10) & 31);
  const g = expand((key >> 5) & 31);
  const b = expand(key & 31);
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
