import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { base32nopad } from '@scure/base';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;

export type TotpAlgorithm = 'sha1' | 'sha256' | 'sha512';

const HASHES = { sha1, sha256, sha512 } as const;

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set(['secret', 'algo', 'digits', 'period', 'time', 'code']);
  const lines = input.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const match = /^([a-z][a-z0-9-]*)\s*:\s*(.*)$/i.exec(lines[i] ?? '');
    if (!match || !known.has(match[1]!.toLowerCase())) break;
    headers[match[1]!.toLowerCase()] = match[2] ?? '';
    i++;
  }
  if (i > 0 && (lines[i] ?? '') === '') i++;
  return { headers, body: lines.slice(i).join('\n') };
}

function parseOtpauth(input: string): Record<string, string> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ToolInputError('That otpauth URL could not be read.');
  }
  if (url.protocol !== 'otpauth:' || url.host.toLowerCase() !== 'totp') {
    throw new ToolInputError('Only otpauth://totp/ links are accepted.');
  }
  const headers: Record<string, string> = {};
  const secret = url.searchParams.get('secret');
  if (!secret) throw new ToolInputError('The otpauth URL has no secret.');
  headers.secret = secret;
  const digits = url.searchParams.get('digits');
  const period = url.searchParams.get('period');
  const algorithm = url.searchParams.get('algorithm');
  if (digits) headers.digits = digits;
  if (period) headers.period = period;
  if (algorithm) headers.algo = algorithm;
  return headers;
}

function decodeSecret(text: string): Uint8Array {
  const cleaned = text
    .trim()
    .replace(/[\s=-]+/g, '')
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/1/g, 'I');
  if (cleaned === '' || /[^A-Z2-7]/.test(cleaned)) throw new ToolInputError('Secret must be Base32.');
  try {
    return base32nopad.decode(cleaned);
  } catch {
    throw new ToolInputError('Secret must be Base32.');
  }
}

function integerHeader(value: string | undefined, fallback: number, label: string, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  if (!/^\d+$/.test(value.trim())) throw new ToolInputError(`${label} must be a whole number.`);
  const n = Number(value.trim());
  if (n < min || n > max) throw new ToolInputError(`${label} must be from ${min} to ${max}.`);
  return n;
}

/** HOTP (RFC 4226): dynamic truncation of HMAC(secret, 8-byte counter). */
export function hotp(secret: Uint8Array, counter: bigint, digits: number, algorithm: TotpAlgorithm): string {
  if (secret.length === 0) throw new ToolInputError('Secret is empty.');
  if (digits < 6 || digits > 8) throw new ToolInputError('Digits must be 6, 7 or 8.');
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, counter);
  const mac = hmac(HASHES[algorithm], secret, msg);
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff);
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totpAt(
  secret: Uint8Array,
  unixSeconds: number,
  period = 30,
  digits = 6,
  algorithm: TotpAlgorithm = 'sha1',
): string {
  if (!Number.isFinite(unixSeconds)) throw new ToolInputError('Time is not a valid timestamp.');
  if (period < 1) throw new ToolInputError('Period must be at least 1 second.');
  const counter = BigInt(Math.floor(unixSeconds / period));
  return hotp(secret, counter, digits, algorithm);
}

/**
 * TOTP (RFC 6238). A bare Base32 secret uses SHA-1, 30 seconds and 6 digits at `now`.
 * `time:` is a Unix timestamp in seconds, so tests and examples stay fixed.
 */
export function totp(input: string, now = Date.now()): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return '';
  const trimmed = input.trim();
  const headers = trimmed.toLowerCase().startsWith('otpauth://')
    ? parseOtpauth(trimmed)
    : headersAndBody(input).headers;
  const body = trimmed.toLowerCase().startsWith('otpauth://') ? '' : headersAndBody(input).body;
  const secretText = headers.secret ?? (body.trim() !== '' ? body.trim() : '');
  if (secretText === '') throw new ToolInputError('Enter a Base32 secret.');
  const algoName = (headers.algo ?? 'sha1')
    .trim()
    .toLowerCase()
    .replace(/^hmac-/, '');
  if (algoName !== 'sha1' && algoName !== 'sha256' && algoName !== 'sha512') {
    throw new ToolInputError('Algorithm must be SHA1, SHA256 or SHA512.');
  }
  const digits = integerHeader(headers.digits, 6, 'Digits', 6, 8);
  const period = integerHeader(headers.period, 30, 'Period', 1, 300);
  const secret = decodeSecret(secretText);
  const unix =
    headers.time !== undefined && headers.time.trim() !== '' ? Number(headers.time.trim()) : Math.floor(now / 1000);
  if (!Number.isFinite(unix)) throw new ToolInputError('time must be a Unix timestamp in seconds.');
  const code = totpAt(secret, unix, period, digits, algoName);
  const lines = [`code: ${code}`, `algorithm: ${algoName}`, `period: ${period}s`, `digits: ${digits}`];
  if (headers.code !== undefined && headers.code.trim() !== '') {
    lines.push(headers.code.trim() === code ? 'match' : 'mismatch');
  }
  return lines.join('\n');
}
