import bcrypt from 'bcryptjs';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;
export const DEFAULT_ROUNDS = 10;
export const MAX_ROUNDS = 12;
export const MIN_ROUNDS = 4;
const B64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set(['mode', 'rounds', 'salt', 'password', 'hash']);
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

/** Encodes 16 salt bytes as the 22-character bcrypt radix-64 alphabet. */
export function encodeBcryptSalt(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new ToolInputError('A bcrypt salt is 16 bytes.');
  let off = 0;
  let out = '';
  while (off < bytes.length) {
    const c1 = bytes[off++]!;
    out += B64[c1 >> 2];
    let acc = (c1 & 0x03) << 4;
    if (off >= bytes.length) {
      out += B64[acc];
      break;
    }
    const c2 = bytes[off++]!;
    acc |= (c2 >> 4) & 0x0f;
    out += B64[acc];
    acc = (c2 & 0x0f) << 2;
    if (off >= bytes.length) {
      out += B64[acc];
      break;
    }
    const c3 = bytes[off++]!;
    acc |= (c3 >> 6) & 0x03;
    out += `${B64[acc]!}${B64[c3 & 0x3f]!}`;
  }
  return out.slice(0, 22);
}

function roundsOf(value: string | undefined, fallback: number): number {
  const raw = value === undefined || value.trim() === '' ? fallback : Number(value.trim());
  if (!Number.isInteger(raw) || raw < MIN_ROUNDS || raw > MAX_ROUNDS) {
    throw new ToolInputError(`Rounds must be a whole number from ${MIN_ROUNDS} to ${MAX_ROUNDS}.`);
  }
  return raw;
}

function passwordOf(headers: Record<string, string>, body: string, bare: boolean, input: string): string {
  if (headers.password !== undefined) return headers.password;
  if (bare) return input;
  return body;
}

/**
 * Hashes or compares a password. A hash is deterministic when `salt:` or `saltBytes` is provided.
 * Compare does not need fresh salt. Cost defaults to 10 and cannot exceed 12.
 */
export function bcryptHash(input: string, saltBytes?: Uint8Array, fallbackRounds = DEFAULT_ROUNDS): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return '';
  const { headers, body } = headersAndBody(input);
  const bare = Object.keys(headers).length === 0;
  const mode = (headers.mode ?? (headers.hash ? 'compare' : 'hash')).trim().toLowerCase();
  const password = passwordOf(headers, body, bare, input);
  if (mode === 'compare') {
    const hash = (headers.hash ?? body.trim()).trim();
    if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) throw new ToolInputError('That is not a bcrypt hash.');
    let ok: boolean;
    try {
      ok = bcrypt.compareSync(password, hash);
    } catch {
      throw new ToolInputError('That is not a bcrypt hash.');
    }
    return ok ? 'match' : 'mismatch';
  }
  if (mode !== 'hash') throw new ToolInputError('mode must be hash or compare.');
  const rounds = roundsOf(headers.rounds, fallbackRounds);
  let salt = headers.salt?.trim();
  if (salt && /^\$2[aby]\$/.test(salt)) {
    // A full salt prefix already carries the cost.
  } else if (salt) {
    if (!/^[./A-Za-z0-9]{22}$/.test(salt))
      throw new ToolInputError('salt must be 22 bcrypt characters or a $2a$ prefix.');
    salt = `$2a$${String(rounds).padStart(2, '0')}$${salt}`;
  } else if (saltBytes) {
    salt = `$2a$${String(rounds).padStart(2, '0')}$${encodeBcryptSalt(saltBytes)}`;
  } else {
    throw new ToolInputError('A salt is required. The page generates one; tests pass salt bytes or a salt: line.');
  }
  try {
    const hash = bcrypt.hashSync(password, salt);
    const note = utf8Length(password) > 72 ? '\nnote: bcrypt only uses the first 72 bytes' : '';
    return hash + note;
  } catch (error) {
    throw new ToolInputError(error instanceof Error ? error.message : 'bcrypt failed.');
  }
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}
