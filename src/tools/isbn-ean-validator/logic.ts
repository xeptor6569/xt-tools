import { ToolInputError } from '../types.ts';

const MAX_INPUT = 40;

/** ISBN-10 check digit. X stands for 10. Weights run from 10 down to 1. */
export function isbn10CheckDigit(first9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (first9.charCodeAt(i) - 48) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

/** EAN-13 / ISBN-13 check digit. Weights alternate 1, 3 from the left. */
export function ean13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (first12.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

/** UPC-A check digit. Weights alternate 3, 1 from the left. */
export function upcACheckDigit(first11: string): string {
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += (first11.charCodeAt(i) - 48) * (i % 2 === 0 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

interface CodeInfo {
  type: string;
  method: string;
  digits: string;
  actual: string;
  calculated: string;
}

function classify(compact: string): CodeInfo {
  if (/^\d{9}[\dX]$/.test(compact)) {
    const body = compact.slice(0, 9);
    return {
      type: 'ISBN-10',
      method: 'ISBN-10 weights 10 down to 1, modulo 11',
      digits: compact,
      actual: compact.slice(9),
      calculated: isbn10CheckDigit(body),
    };
  }
  if (/^\d{12}$/.test(compact)) {
    return {
      type: 'UPC-A',
      method: 'UPC-A weights 3 and 1',
      digits: compact,
      actual: compact.slice(11),
      calculated: upcACheckDigit(compact.slice(0, 11)),
    };
  }
  if (/^\d{13}$/.test(compact)) {
    const isbn = compact.startsWith('978') || compact.startsWith('979');
    return {
      type: isbn ? 'ISBN-13 (EAN-13)' : 'EAN-13',
      method: 'EAN-13 weights 1 and 3',
      digits: compact,
      actual: compact.slice(12),
      calculated: ean13CheckDigit(compact.slice(0, 12)),
    };
  }
  throw new ToolInputError('Enter an ISBN-10, ISBN-13, EAN-13 or UPC-A. Hyphens and spaces are ignored.');
}

/** Detects ISBN-10, ISBN-13, EAN-13 or UPC-A and checks the check digit. */
export function isbnEanValidator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 40 characters).');
  const text = input.trim();
  if (text === '') return '';
  const compact = text
    .replace(/^isbn[:\s-]*/i, '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  const info = classify(compact);
  const status = info.actual === info.calculated ? 'valid' : 'invalid';
  return [
    `Type: ${info.type}`,
    `Digits: ${info.digits}`,
    `Method: ${info.method}`,
    `Check digit: ${info.actual}`,
    `Calculated check digit: ${info.calculated}`,
    `Status: ${status}`,
  ].join('\n');
}
