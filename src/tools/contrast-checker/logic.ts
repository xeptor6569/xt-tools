import { ToolInputError } from '../types.ts';

const MAX_INPUT = 80;

export interface ContrastReport {
  foreground: string;
  background: string;
  /** WCAG contrast ratio, (L1 + 0.05) / (L2 + 0.05). */
  ratio: number;
  text: string;
}

function normalizeHex(token: string): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(token);
  const hex = match?.[1];
  if (!hex) throw new ToolInputError(`"${token}" is not a hex color such as #000000.`);
  const full =
    hex.length === 3
      ? Array.from(hex)
          .map((ch) => ch + ch)
          .join('')
      : hex;
  return `#${full.toLowerCase()}`;
}

function channel(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2 relative luminance for an sRGB hex color. */
export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex);
  const rgb = Number.parseInt(normalized.slice(1), 16);
  const red = channel(((rgb >> 16) & 255) / 255);
  const green = channel(((rgb >> 8) & 255) / 255);
  const blue = channel((rgb & 255) / 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2 contrast ratio. Order does not matter. */
export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function formatRatio(ratio: number): string {
  const rounded = Math.round(ratio * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text}:1`;
}

function grade(ratio: number, minimum: number): 'pass' | 'fail' {
  return ratio + 1e-9 >= minimum ? 'pass' : 'fail';
}

/** Checks two hex colors against WCAG AA and AAA for normal and large text. */
export function parseContrast(input: string): ContrastReport | undefined {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 80 characters).');
  const text = input.trim();
  if (text === '') return undefined;
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 2) {
    throw new ToolInputError('Enter a foreground and a background, for example: #000000 #ffffff');
  }
  const [foregroundToken, backgroundToken] = parts;
  if (!foregroundToken || !backgroundToken) {
    throw new ToolInputError('Enter a foreground and a background, for example: #000000 #ffffff');
  }
  const foreground = normalizeHex(foregroundToken);
  const background = normalizeHex(backgroundToken);
  const ratio = contrastRatio(foreground, background);
  const lines = [
    `Foreground: ${foreground}`,
    `Background: ${background}`,
    `Contrast ratio: ${formatRatio(ratio)}`,
    `Normal text: AA ${grade(ratio, 4.5)}, AAA ${grade(ratio, 7)}`,
    `Large text: AA ${grade(ratio, 3)}, AAA ${grade(ratio, 4.5)}`,
    'Large text is 18pt or 14pt bold.',
  ];
  return { foreground, background, ratio, text: lines.join('\n') };
}

export function contrastChecker(input: string): string {
  return parseContrast(input)?.text ?? '';
}
