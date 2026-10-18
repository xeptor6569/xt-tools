import { base32, base58, base64, base64url, hex } from '@scure/base';
import { ToolInputError } from '../types.ts';
import { ascii85Decode, ascii85Encode } from './ascii85.ts';

export type Encoding = 'base64' | 'base64url' | 'base32' | 'base58' | 'ascii85' | 'hex';
export type Direction = 'encode' | 'decode';

export const ENCODINGS: ReadonlyArray<{ value: Encoding; label: string }> = [
  { value: 'base64', label: 'Base64' },
  { value: 'base64url', label: 'Base64URL' },
  { value: 'base32', label: 'Base32' },
  { value: 'base58', label: 'Base58 (Bitcoin)' },
  { value: 'ascii85', label: 'Base85 (Ascii85)' },
  { value: 'hex', label: 'Hex (Base16)' },
];

export interface CodecResult {
  text: string;
  /** Set when decoded bytes aren't valid UTF-8 and are shown as hex instead. */
  binary: boolean;
}

const MAX_INPUT = 10_000_000;
// Base58 is quadratic in the input length; @scure/base caps it at these sizes.
const MAX_BASE58_BYTES = 2048;
const MAX_BASE58_CHARS = 4096;
const pad = (s: string, size: number) => s + '='.repeat((size - (s.length % size)) % size);

function encodeBytes(bytes: Uint8Array, encoding: Encoding): string {
  switch (encoding) {
    case 'base64':
      return base64.encode(bytes);
    case 'base64url':
      return base64url.encode(bytes).replace(/=+$/, '');
    case 'base32':
      return base32.encode(bytes);
    case 'base58':
      if (bytes.length > MAX_BASE58_BYTES) {
        throw new ToolInputError(`Base58 is for short values; it is limited to ${MAX_BASE58_BYTES} bytes.`);
      }
      return base58.encode(bytes);
    case 'ascii85':
      return ascii85Encode(bytes);
    case 'hex':
      return hex.encode(bytes);
  }
}

function decodeText(text: string, encoding: Encoding): Uint8Array {
  const s = encoding === 'ascii85' ? text : text.replace(/\s+/g, '');
  if (encoding === 'base58' && s.length > MAX_BASE58_CHARS) {
    throw new ToolInputError(`Base58 is for short values; it is limited to ${MAX_BASE58_CHARS} characters.`);
  }
  try {
    switch (encoding) {
      case 'base64':
        return base64.decode(pad(s, 4));
      case 'base64url':
        return base64url.decode(pad(s, 4));
      case 'base32':
        return base32.decode(pad(s.toUpperCase(), 8));
      case 'base58':
        return base58.decode(s);
      case 'ascii85':
        return ascii85Decode(s);
      case 'hex':
        return hex.decode(s.toLowerCase().replace(/^0x/, ''));
    }
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    const label = ENCODINGS.find((e) => e.value === encoding)?.label ?? encoding;
    throw new ToolInputError(`This isn't valid ${label}.`);
  }
}

/** Encodes text (as UTF-8) or decodes it back. Decoded binary data is shown as hex. */
export function baseEncoder(input: string, encoding: Encoding, direction: Direction): CodecResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 10 MB).');
  if (direction === 'encode') {
    return { text: encodeBytes(new TextEncoder().encode(input), encoding), binary: false };
  }
  if (input.trim() === '') return { text: '', binary: false };
  const bytes = decodeText(input, encoding);
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), binary: false };
  } catch {
    return { text: hex.encode(bytes), binary: true };
  }
}
