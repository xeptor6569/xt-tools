import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/**
 * Unfold RFC 5322 headers (a CRLF before whitespace is removed) and list name/value pairs.
 * Stops at the blank line before the body. Does not look anything up.
 */
export function emailHeaders(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const unfolded = input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n([ \t])/g, '$1');
  const lines: string[] = [];
  for (const line of unfolded.split('\n')) {
    if (line === '') break;
    const colon = line.indexOf(':');
    if (colon <= 0) throw new ToolInputError(`This line is not a header: ${line.slice(0, 80)}`);
    const name = line.slice(0, colon).trim();
    if (!NAME.test(name)) throw new ToolInputError(`Invalid header name "${name.slice(0, 40)}".`);
    lines.push(`${name}: ${line.slice(colon + 1).trimStart()}`);
  }
  return lines.join('\n');
}
