import {
  clampChroma,
  colorsNamed,
  converter,
  displayable,
  formatHex,
  formatHex8,
  formatHsl,
  formatRgb,
  parse,
} from 'culori';
import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
  note?: string;
  mono?: boolean;
}

export interface ColorResult {
  formats: Variant[];
  /** A CSS color the preview swatch can use (clamped into sRGB). */
  swatch: string;
  inGamut: boolean;
}

const MAX_INPUT = 200;

const round = (n: number | undefined, digits: number) => {
  if (n === undefined || Number.isNaN(n)) return 'none';
  const f = 10 ** digits;
  return String(Math.round(n * f) / f);
};
const pct = (n: number | undefined, digits = 1) => (n === undefined ? 'none' : `${round(n * 100, digits)}%`);
const alpha = (a: number | undefined) => (a === undefined || a >= 1 ? '' : ` / ${round(a, 3)}`);

const toLab = converter('lab');
const toLch = converter('lch');
const toOklab = converter('oklab');
const toOklch = converter('oklch');
const toHwb = converter('hwb');
const toRgb = converter('rgb');

const namesByHex = new Map(
  Object.entries(colorsNamed).map(([name, value]) => [`#${value.toString(16).padStart(6, '0')}`, name]),
);

/** Parses any CSS color (hex, rgb(), hsl(), named, oklch(), color(display-p3 ...), ...). */
export function colorConverter(input: string): ColorResult | undefined {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too long.');
  const text = input.trim();
  if (text === '') return undefined;
  const parsed = parse(/^[0-9a-f]{3,8}$/i.test(text) ? `#${text}` : text);
  if (!parsed) throw new ToolInputError(`"${text}" isn't a CSS color this tool understands.`);

  const inGamut = displayable(parsed);
  const srgb = toRgb(inGamut ? parsed : clampChroma(parsed, 'oklch'));
  const hex = formatHex(srgb);
  const gamutNote = inGamut ? undefined : 'Outside sRGB: chroma reduced to fit.';
  const lab = toLab(parsed);
  const lch = toLch(parsed);
  const oklab = toOklab(parsed);
  const oklch = toOklch(parsed);
  const hwb = toHwb(srgb);
  const a = parsed.alpha;

  const formats: Variant[] = [
    {
      label: 'HEX',
      value: a !== undefined && a < 1 ? formatHex8({ ...srgb, alpha: a }) : hex,
      ...(gamutNote ? { note: gamutNote } : {}),
    },
    {
      label: 'RGB',
      value: formatRgb({ ...srgb, ...(a !== undefined ? { alpha: a } : {}) }),
      ...(gamutNote ? { note: gamutNote } : {}),
    },
    { label: 'HSL', value: formatHsl({ ...converter('hsl')(srgb), ...(a !== undefined ? { alpha: a } : {}) }) },
    { label: 'HWB', value: `hwb(${round(hwb.h ?? 0, 2)} ${pct(hwb.w)} ${pct(hwb.b)}${alpha(a)})` },
    { label: 'Lab', value: `lab(${round(lab.l, 2)}% ${round(lab.a, 2)} ${round(lab.b, 2)}${alpha(a)})` },
    { label: 'LCH', value: `lch(${round(lch.l, 2)}% ${round(lch.c, 2)} ${round(lch.h ?? 0, 2)}${alpha(a)})` },
    { label: 'OKLab', value: `oklab(${round(oklab.l, 4)} ${round(oklab.a, 4)} ${round(oklab.b, 4)}${alpha(a)})` },
    { label: 'OKLCH', value: `oklch(${round(oklch.l, 4)} ${round(oklch.c, 4)} ${round(oklch.h ?? 0, 2)}${alpha(a)})` },
  ];
  const name = inGamut && (a === undefined || a >= 1) ? namesByHex.get(hex) : undefined;
  if (name) formats.push({ label: 'CSS name', value: name, mono: false });

  return { formats, swatch: formatRgb({ ...srgb, ...(a !== undefined ? { alpha: a } : {}) }), inGamut };
}
