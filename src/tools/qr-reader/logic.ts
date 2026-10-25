import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export const NO_QR = 'No QR code found.';

/** Normalizes decoded QR text. Blank input means the scan found nothing. */
export function qrReader(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('That QR payload is too large.');
  const text = input.trim();
  return text === '' ? NO_QR : text;
}
