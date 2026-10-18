import { ToolInputError } from '../types.ts';
import { CATEGORIES } from './units.ts';

export interface Variant {
  label: string;
  value: string;
}

const MAX_INPUT = 100;

// Temperatures: convert through kelvin.
const TO_K: Record<string, (v: number) => number> = {
  c: (v) => v + 273.15,
  f: (v) => ((v - 32) * 5) / 9 + 273.15,
  k: (v) => v,
  r: (v) => (v * 5) / 9,
};
const FROM_K: Record<string, (k: number) => number> = {
  c: (k) => k - 273.15,
  f: (k) => ((k - 273.15) * 9) / 5 + 32,
  k: (k) => k,
  r: (k) => (k * 9) / 5,
};

export function format(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-6) return n.toExponential(9).replace(/\.?0+e/, 'e');
  // Round away floating-point noise (0.1 + 0.2), then show up to 12 significant digits.
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 12, useGrouping: true }).format(
    Number(n.toPrecision(12)),
  );
}

export function parseValue(text: string): number {
  const s = text.trim().replace(/[\s,_]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s))
    throw new ToolInputError('Enter a number, such as 12, 3.5 or 1e6.');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new ToolInputError('That number is too large.');
  return n;
}

export function convert(value: number, categoryId: string, from: string, to: string): number {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const a = category?.units.find((x) => x.id === from);
  const b = category?.units.find((x) => x.id === to);
  if (!category || !a || !b) throw new ToolInputError('Unknown unit.');
  if (categoryId === 'temperature') {
    const k = TO_K[from]!(value);
    if (k < 0) throw new ToolInputError('That is below absolute zero (−273.15 °C).');
    return FROM_K[to]!(k);
  }
  return (value * a.factor) / b.factor;
}

/** Converts `input` (a number in `from`) to every unit in the category. */
export function unitConverter(input: string, categoryId: string, from: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too long.');
  if (input.trim() === '') return [];
  const value = parseValue(input);
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) throw new ToolInputError('Unknown category.');
  return category.units.map((unit) => ({
    label: unit.label,
    value: format(convert(value, categoryId, from, unit.id)),
  }));
}
