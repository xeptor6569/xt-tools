import { ToolInputError } from '../types.ts';

const MAX_INPUT = 20_000;
const MAX_CODE128 = 80;
const START_B = 104;
const STOP = '1100011101011';

/** Code 128 symbol patterns, values 0–105. 1 is a bar. Stop is separate. */
const CODE128 = [
  '11011001100',
  '11001101100',
  '11001100110',
  '10010011000',
  '10010001100',
  '10001001100',
  '10011001000',
  '10011000100',
  '10001100100',
  '11001001000',
  '11001000100',
  '11000100100',
  '10110011100',
  '10011011100',
  '10011001110',
  '10111001100',
  '10011101100',
  '10011100110',
  '11001110010',
  '11001011100',
  '11001001110',
  '11011100100',
  '11001110100',
  '11101101110',
  '11101001100',
  '11100101100',
  '11100100110',
  '11101100100',
  '11100110100',
  '11100110010',
  '11011011000',
  '11011000110',
  '11000110110',
  '10100011000',
  '10001011000',
  '10001000110',
  '10110001000',
  '10001101000',
  '10001100010',
  '11010001000',
  '11000101000',
  '11000100010',
  '10110111000',
  '10110001110',
  '10001101110',
  '10111011000',
  '10111000110',
  '10001110110',
  '11101110110',
  '11010001110',
  '11000101110',
  '11011101000',
  '11011100010',
  '11011101110',
  '11101011000',
  '11101000110',
  '11100010110',
  '11101101000',
  '11101100010',
  '11100011010',
  '11101111010',
  '11001000010',
  '11110001010',
  '10100110000',
  '10100001100',
  '10010110000',
  '10010000110',
  '10000101100',
  '10000100110',
  '10110010000',
  '10110000100',
  '10011010000',
  '10011000010',
  '10000110100',
  '10000110010',
  '11000010010',
  '11001010000',
  '11110111010',
  '11000010100',
  '10001111010',
  '10100111100',
  '10010111100',
  '10010011110',
  '10111100100',
  '10011110100',
  '10011110010',
  '11110100100',
  '11110010100',
  '11110010010',
  '11011011110',
  '11011110110',
  '11110110110',
  '10101111000',
  '10100011110',
  '10001011110',
  '10111101000',
  '10111100010',
  '11110101000',
  '11110100010',
  '10111011110',
  '10111101110',
  '11101011110',
  '11110101110',
  '11010000100',
  '11010010000',
  '11010011100',
] as const;

const EAN_L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
] as const;
const EAN_G = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
] as const;
const EAN_R = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
] as const;
const EAN_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
] as const;

export interface Barcode {
  /** Human-readable line for the output field. */
  label: string;
  /** 1 = bar. Quiet zone is added when drawing, not here. */
  bits: string;
}

/**
 * `ean 590123412345` (12 digits, check digit added) or Code 128 set B text.
 * `code128 …` forces set B. Anything else is set B too.
 */
export function barcodeGenerator(input: string): string {
  return encodeBarcode(input)?.label ?? '';
}

export function encodeBarcode(input: string): Barcode | undefined {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const text = input.trimStart();
  if (text.trim() === '') return undefined;
  const lower = text.toLowerCase();
  if (lower.startsWith('ean-13 ') || lower.startsWith('ean13 ') || lower.startsWith('ean ')) {
    const digits = text.slice(text.indexOf(' ') + 1).replace(/[\s-]/g, '');
    return ean13(digits);
  }
  if (lower.startsWith('code128 ') || lower.startsWith('c128 ')) {
    return code128(text.slice(text.indexOf(' ') + 1));
  }
  return code128(text);
}

export function eanCheckDigit(digits12: string): number {
  if (!/^\d{12}$/.test(digits12)) throw new ToolInputError('EAN-13 needs 12 digits before the check digit.');
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

function ean13(digits: string): Barcode {
  if (!/^\d{12,13}$/.test(digits)) throw new ToolInputError('EAN-13 needs 12 digits, or 13 including the check digit.');
  const body = digits.slice(0, 12);
  const check = eanCheckDigit(body);
  if (digits.length === 13 && Number(digits[12]) !== check) {
    throw new ToolInputError(`Check digit should be ${check} (got ${digits[12]}).`);
  }
  const full = body + String(check);
  const first = Number(full[0]);
  const parity = EAN_PARITY[first] ?? 'LLLLLL';
  let bits = '101';
  for (let i = 0; i < 6; i++) {
    const digit = Number(full[i + 1]);
    const table = parity[i] === 'G' ? EAN_G : EAN_L;
    bits += table[digit] ?? '';
  }
  bits += '01010';
  for (let i = 7; i < 13; i++) bits += EAN_R[Number(full[i])] ?? '';
  bits += '101';
  return { label: `EAN-13 ${full}`, bits };
}

export function code128Bits(text: string): string {
  return code128(text).bits;
}

function code128(text: string): Barcode {
  if (text.length === 0) throw new ToolInputError('Enter the text to encode.');
  if (text.length > MAX_CODE128)
    throw new ToolInputError(`Code 128 set B is limited to ${MAX_CODE128} characters here.`);
  const values: number[] = [START_B];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code > 126) {
      throw new ToolInputError('Code 128 set B only covers printable ASCII (space through ~).');
    }
    values.push(code - 32);
  }
  let sum = values[0] ?? 0;
  for (let i = 1; i < values.length; i++) sum += i * (values[i] ?? 0);
  values.push(sum % 103);
  let bits = '';
  for (const value of values) bits += CODE128[value] ?? '';
  bits += STOP;
  return { label: `Code 128B ${text}`, bits };
}
