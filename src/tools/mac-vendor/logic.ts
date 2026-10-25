import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

/** Uppercase hex prefix (at least 6 digits, no separators) to a vendor name. */
export type OuiTable = Record<string, string>;

/**
 * Look up one or more MAC addresses. A missing prefix is reported as
 * "Not found" and does not throw. The longest matching prefix wins.
 */
export function macVendor(input: string, table: OuiTable = {}): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  return lines
    .map((line) => {
      const hex = normalizeMac(line);
      const vendor = lookupOui(hex, table);
      return `${displayMac(hex)}\t${vendor ?? 'Not found'}`;
    })
    .join('\n');
}

export function lookupOui(hex: string, table: OuiTable): string | undefined {
  const upper = hex.toUpperCase();
  for (let length = Math.min(upper.length, 12); length >= 6; length--) {
    const name = table[upper.slice(0, length)];
    if (name) return name;
  }
  return undefined;
}

export function normalizeMac(text: string): string {
  const hex = text.trim().replace(/[^0-9a-f]/gi, '');
  if (!/^[0-9a-f]{6,12}$/i.test(hex) || hex.length !== text.replace(/[:.\-\s]/g, '').length) {
    throw new ToolInputError(`"${text.trim()}" is not a MAC address or OUI. Use 6 to 12 hex digits.`);
  }
  return hex.toUpperCase();
}

function displayMac(hex: string): string {
  if (hex.length % 2 !== 0) return hex;
  return hex.match(/.{2}/g)?.join(':') ?? hex;
}
