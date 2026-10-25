import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export type FrameOption = 'DENY' | 'SAMEORIGIN';
export type ReferrerOption =
  'no-referrer' | 'strict-origin-when-cross-origin' | 'same-origin' | 'origin-when-cross-origin';

export interface SecurityHeaderOptions {
  frame: FrameOption;
  referrer: ReferrerOption;
  nosniff: boolean;
  csp: string;
}

export const DEFAULT_CSP =
  "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

export const DEFAULT_OPTIONS: SecurityHeaderOptions = {
  frame: 'DENY',
  referrer: 'no-referrer',
  nosniff: true,
  csp: DEFAULT_CSP,
};

const HEADER_LINE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+:\s*\S/;

/** A starter header block. Extra lines, when present, must look like `Name: value`. */
export function securityHeaders(extra: string, options: SecurityHeaderOptions = DEFAULT_OPTIONS): string {
  if (extra.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const lines: string[] = [];
  if (options.nosniff) lines.push('X-Content-Type-Options: nosniff');
  lines.push(`X-Frame-Options: ${options.frame}`);
  lines.push(`Referrer-Policy: ${options.referrer}`);
  lines.push(`Content-Security-Policy: ${options.csp}`);
  lines.push('Permissions-Policy: camera=(), microphone=(), geolocation=()');
  const trimmed = extra.trim();
  if (trimmed) {
    for (const raw of trimmed.split(/\n/)) {
      const line = raw.trim();
      if (line === '') continue;
      if (!HEADER_LINE.test(line)) {
        throw new ToolInputError('Extra headers must look like "Name: value", or leave this blank.');
      }
      lines.push(line);
    }
  }
  return lines.join('\n');
}
