import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

function tooLarge(input: string): void {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
}

function encodeText(input: string): string {
  try {
    return encodeURIComponent(input);
  } catch {
    throw new ToolInputError('This text cannot be encoded as a data URI.');
  }
}

function decodeBase64(payload: string): string {
  const cleaned = payload.replace(/\s+/g, '');
  let bytes: Uint8Array;
  try {
    const binary = atob(cleaned);
    bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  } catch {
    throw new ToolInputError('The data URI is not valid base64.');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return `Binary data (${bytes.length} bytes).`;
  }
}

function decodeDataUri(input: string): string {
  const comma = input.indexOf(',');
  if (comma < 0) throw new ToolInputError('A data URI needs a comma before the data.');
  const meta = input.slice('data:'.length, comma);
  const data = input.slice(comma + 1);
  const base64 = meta.split(';').some((part) => part.trim().toLowerCase() === 'base64');
  if (base64) return decodeBase64(data);
  try {
    return decodeURIComponent(data);
  } catch {
    throw new ToolInputError('The data URI is not valid percent-encoding.');
  }
}

/** Encode text as a data URI, or decode one. Direction follows the input. */
export function dataUri(input: string): string {
  tooLarge(input);
  const trimmed = input.trim();
  if (trimmed === '') return '';
  if (trimmed.startsWith('data:')) return decodeDataUri(trimmed);
  return `data:text/plain;charset=utf-8,${encodeText(input)}`;
}
