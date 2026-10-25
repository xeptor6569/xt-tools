import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

/** Base64 of the UTF-8 bytes, the encoding RFC 7617 specifies for Basic. */
export function basicCredentials(userpass: string): string {
  const bytes = new TextEncoder().encode(userpass);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** `user:pass` becomes an Authorization header. The password may contain colons. */
export function basicAuth(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const colon = trimmed.indexOf(':');
  if (colon < 0) throw new ToolInputError('Enter username:password.');
  return `Authorization: Basic ${basicCredentials(trimmed)}`;
}
