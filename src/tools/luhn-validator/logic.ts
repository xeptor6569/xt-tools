import { ToolInputError } from '../types.ts';

const MAX_INPUT = 64;

/** Luhn checksum. Doubles every second digit from the right. */
export function luhnChecksumValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Checks a number with the Luhn algorithm. For documented test numbers only:
 * nothing is stored and no payment service is contacted.
 */
export function luhnValidator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 64 characters).');
  const text = input.trim();
  if (text === '') return '';
  const digits = text.replace(/[\s-]/g, '');
  if (!/^\d{2,19}$/.test(digits)) {
    throw new ToolInputError('Enter 2 to 19 digits. Spaces and dashes are ignored. This is for test numbers only.');
  }
  const valid = luhnChecksumValid(digits);
  return `${digits}\nLuhn: ${valid ? 'valid' : 'invalid'}\nDigits: ${digits.length}`;
}
