import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

const MAX_INPUT = 1_000_000;
const PERCENT = /%(?:[0-9A-Fa-f]{2})/;

function tooLarge(input: string): void {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
}

function encode(input: string): string {
  try {
    return encodeURIComponent(input);
  } catch {
    throw new ToolInputError('This text cannot be percent-encoded.');
  }
}

function decode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    throw new ToolInputError('Invalid percent-encoding.');
  }
}

/** Encode with encodeURIComponent, and decode when the text already contains %HH. */
export function urlEncoder(input: string): Variant[] {
  tooLarge(input);
  const encoded = encode(input);
  const autoDecode = PERCENT.test(input);
  const decoded = autoDecode ? decode(input) : input.includes('%') ? safeDecode(input) : input;
  return [
    { label: 'Encoded', value: encoded },
    { label: 'Decoded', value: decoded },
    { label: 'Auto', value: autoDecode ? decoded : encoded },
  ];
}

/** Decode when possible; leave text that only has a stray % unchanged. */
function safeDecode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}
