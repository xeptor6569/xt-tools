import { formatIpv4, maskFromPrefix, parseIpv4, prefixFromMask } from '../../lib/ipv4.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface Variant {
  label: string;
  value: string;
}

/** Convert a prefix length, a subnet mask, or a Cisco wildcard into the other two. */
export function wildcardMask(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return [];
  const prefix = detectPrefix(trimmed);
  const mask = maskFromPrefix(prefix);
  const wildcard = ~mask >>> 0;
  return [
    { label: 'Prefix length', value: `/${prefix}` },
    { label: 'Subnet mask', value: formatIpv4(mask) },
    { label: 'Wildcard mask', value: formatIpv4(wildcard) },
  ];
}

function detectPrefix(text: string): number {
  const keyword = text.match(/^(prefix|mask|wildcard|wild)\s+(\S+)$/i);
  if (keyword) {
    const kind = (keyword[1] ?? '').toLowerCase();
    const value = keyword[2] ?? '';
    if (kind === 'prefix') return prefixLength(value);
    if (kind === 'mask') return prefixFromMask(parseIpv4(value));
    return prefixFromWildcard(value);
  }
  if (text.startsWith('/') || /^\d{1,2}$/.test(text)) return prefixLength(text);
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(text)) {
    throw new ToolInputError(
      `"${text}" is not a prefix length, subnet mask, or wildcard. Try /24, 255.255.255.0, or 0.0.0.255.`,
    );
  }
  const asMask = tryPrefix(() => prefixFromMask(parseIpv4(text)));
  const asWild = tryPrefix(() => prefixFromWildcard(text));
  if (asMask !== undefined) return asMask;
  if (asWild !== undefined) return asWild;
  throw new ToolInputError(`${text} is not a contiguous subnet mask or wildcard.`);
}

function prefixLength(text: string): number {
  const value = text.startsWith('/') ? text.slice(1) : text;
  if (!/^\d{1,2}$/.test(value) || Number(value) > 32) {
    throw new ToolInputError('The prefix length must be between 0 and 32.');
  }
  return Number(value);
}

function prefixFromWildcard(text: string): number {
  const wildcard = parseIpv4(text);
  const mask = ~wildcard >>> 0;
  try {
    return prefixFromMask(mask);
  } catch {
    throw new ToolInputError(`${text} is not a contiguous wildcard mask.`);
  }
}

function tryPrefix(fn: () => number): number | undefined {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ToolInputError) return undefined;
    throw error;
  }
}
