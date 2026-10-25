import { ToolInputError } from '../types.ts';

const MAX_INPUT = 80;

/** ISO 13616 IBAN lengths. Unknown countries are checked with MOD-97 only. */
const LENGTHS: Record<string, number> = {
  AD: 24,
  AE: 23,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BH: 22,
  BR: 29,
  BY: 28,
  CH: 21,
  CR: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  DO: 28,
  EE: 20,
  EG: 29,
  ES: 24,
  FI: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  GT: 28,
  HR: 21,
  HU: 28,
  IE: 22,
  IL: 23,
  IQ: 23,
  IS: 26,
  IT: 27,
  JO: 30,
  KW: 30,
  KZ: 20,
  LB: 28,
  LC: 32,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MR: 27,
  MT: 31,
  MU: 30,
  NL: 18,
  NO: 15,
  PK: 24,
  PL: 28,
  PS: 29,
  PT: 25,
  QA: 29,
  RO: 24,
  RS: 22,
  SA: 24,
  SC: 31,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  ST: 25,
  SV: 28,
  TL: 23,
  TN: 24,
  TR: 26,
  UA: 29,
  VA: 22,
  VG: 24,
  XK: 20,
};

export function groupIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

/** ISO 7064 MOD 97-10. A valid IBAN has remainder 1. */
export function ibanMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const chunk = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of chunk) remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return remainder;
}

function countryLabel(code: string): string {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return code;
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    if (!name || name.toUpperCase() === code.toUpperCase()) return code;
    return `${name} (${code})`;
  } catch {
    return code;
  }
}

/** Checks an IBAN with MOD-97 and prints it in groups of four. */
export function ibanValidator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 80 characters).');
  const text = input.trim();
  if (text === '') return '';
  const iban = text.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    throw new ToolInputError('Enter an IBAN: two letters, two check digits, then up to 30 letters or digits.');
  }
  const country = iban.slice(0, 2);
  const expected = LENGTHS[country];
  if (expected !== undefined && iban.length !== expected) {
    throw new ToolInputError(`${country} IBANs are ${expected} characters. This one is ${iban.length}.`);
  }
  if (ibanMod97(iban) !== 1) throw new ToolInputError('The IBAN checksum is wrong (MOD-97).');
  return [`Valid IBAN`, groupIban(iban), `Country: ${countryLabel(country)}`, `Checksum: MOD-97 OK`].join('\n');
}
