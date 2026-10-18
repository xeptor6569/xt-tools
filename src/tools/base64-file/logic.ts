import { base64 } from '@scure/base';
import { ToolInputError } from '../types.ts';

export const MAX_BYTES = 20 * 1024 * 1024;
const MAX_TEXT = Math.ceil((MAX_BYTES * 4) / 3) + 1000;

export interface Encoded {
  base64: string;
  dataUri: string;
}

export interface Decoded {
  bytes: Uint8Array;
  mime: string;
  extension: string;
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/css': 'css',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4',
  'font/woff2': 'woff2',
};

/** Recognises common file types from their first bytes. */
export function sniffMime(bytes: Uint8Array): string {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (starts(0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
  if (starts(0x50, 0x4b, 0x03, 0x04)) return 'application/zip';
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  if (starts(0x77, 0x4f, 0x46, 0x32)) return 'font/woff2';
  return 'application/octet-stream';
}

export function encodeFile(bytes: Uint8Array, mime: string): Encoded {
  if (bytes.length > MAX_BYTES) throw new ToolInputError('File is too large (maximum 20 MB).');
  const type = mime || sniffMime(bytes);
  const b64 = base64.encode(bytes);
  return { base64: b64, dataUri: `data:${type};base64,${b64}` };
}

/** Accepts raw Base64 (with or without line breaks) or a data URI. */
export function decodeBase64(text: string): Decoded {
  if (text.length > MAX_TEXT) throw new ToolInputError('Input is too large (maximum 20 MB of data).');
  const trimmed = text.trim();
  if (trimmed === '') throw new ToolInputError('Paste Base64 text or a data: URI.');
  const match = /^data:([^;,]*)(?:;[^,]*)?,(.*)$/s.exec(trimmed);
  if (match && !/;base64,/i.test(trimmed.slice(0, trimmed.indexOf(',') + 1))) {
    throw new ToolInputError('Only Base64 data URIs are supported (they contain ";base64,").');
  }
  const body = (match ? (match[2] ?? '') : trimmed).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
  let bytes: Uint8Array;
  try {
    bytes = base64.decode(padded);
  } catch {
    throw new ToolInputError("This isn't valid Base64.");
  }
  const mime = match?.[1] || sniffMime(bytes);
  return { bytes, mime, extension: EXTENSIONS[mime] ?? 'bin' };
}
