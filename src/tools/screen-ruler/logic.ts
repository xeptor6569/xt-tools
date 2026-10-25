import { formatNumber } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000;
const FORM = /^([+]?(?:\d+\.?\d*|\.\d+))\s*(mm|millimeters|millimetres)\s+for\s+([+]?(?:\d+\.?\d*|\.\d+))\s*px$/i;

/** CSS pixels per inch, from a known physical length. 1 inch = 25.4 mm. */
export function dpiFromMillimeters(px: number, millimeters: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(millimeters)) throw new ToolInputError('Enter finite numbers.');
  if (px <= 0 || millimeters <= 0) throw new ToolInputError('Pixels and millimetres must be greater than zero.');
  return px / (millimeters / 25.4);
}

/** "25.4 mm for 96 px" style DPI estimate. */
export function screenRuler(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const text = input.trim();
  if (text === '') return '';
  const match = FORM.exec(text);
  if (!match) throw new ToolInputError('Use the form "25.4 mm for 96 px".');
  const millimeters = Number(match[1]);
  const px = Number(match[3]);
  return `${formatNumber(dpiFromMillimeters(px, millimeters))} DPI`;
}
