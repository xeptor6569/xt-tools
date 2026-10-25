import { blockContainsIp, parseCidr, parseIpv4 } from '../../lib/ipv4.ts';
import { compareIpv6, ipv6Contains, parseIpv6, parseIpv6Prefix } from '../../lib/ipv6.ts';
import { ToolInputError, isToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_RANGES = 10_000;

/** First line is an address. Each later line is a CIDR or an inclusive start-end range. */
export function ipInRange(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const lines = meaningfulLines(input);
  if (lines.length === 0) return '';
  const [first, ...ranges] = lines;
  if (!first) return '';
  if (ranges.length === 0) {
    throw new ToolInputError('Add at least one CIDR or start-end range on the following lines.');
  }
  if (ranges.length > MAX_RANGES) throw new ToolInputError(`Enter at most ${MAX_RANGES} ranges.`);
  const v6 = first.text.includes(':');
  return ranges
    .map((range) => {
      const inside = v6 ? matchesV6(first.text, range.text) : matchesV4(first.text, range.text);
      return `${range.text}: ${inside ? 'yes' : 'no'}`;
    })
    .join('\n');
}

function meaningfulLines(input: string): Array<{ text: string; line: number }> {
  const out: Array<{ text: string; line: number }> = [];
  input.split(/\r?\n/).forEach((raw, index) => {
    const text = raw.replace(/#.*/, '').trim();
    if (text !== '') out.push({ text, line: index + 1 });
  });
  return out;
}

function matchesV4(ipText: string, rangeText: string): boolean {
  let ip: number;
  try {
    ip = parseIpv4(ipText);
  } catch (error) {
    rethrow(error);
    throw error;
  }
  try {
    if (rangeText.includes(':')) throw new ToolInputError('That range is IPv6, but the address is IPv4.');
    if (rangeText.includes('/')) return blockContainsIp(parseCidr(rangeText), ip);
    const [start, end] = parseV4Span(rangeText);
    return ip >= start && ip <= end;
  } catch (error) {
    rethrow(error, rangeText);
    throw error;
  }
}

function matchesV6(ipText: string, rangeText: string): boolean {
  let ip: Uint8Array;
  try {
    ip = parseIpv6(ipText);
  } catch (error) {
    rethrow(error);
    throw error;
  }
  try {
    if (rangeText.includes('/')) {
      const { address, prefix } = parseIpv6Prefix(rangeText);
      return ipv6Contains(address, prefix, ip);
    }
    if (!rangeText.includes(':')) throw new ToolInputError('That range is IPv4, but the address is IPv6.');
    const [start, end] = parseV6Span(rangeText);
    return compareIpv6(ip, start) >= 0 && compareIpv6(ip, end) <= 0;
  } catch (error) {
    rethrow(error, rangeText);
    throw error;
  }
}

function parseV4Span(text: string): [number, number] {
  const parts = text.split(/\s*-\s*/);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ToolInputError(`"${text}" is not a CIDR or a start-end range.`);
  }
  const start = parseIpv4(parts[0]);
  const end = parseIpv4(parts[1]);
  if (start > end) throw new ToolInputError('The start address must not be after the end address.');
  return [start, end];
}

function parseV6Span(text: string): [Uint8Array, Uint8Array] {
  const parts = text.split(/\s*-\s*/);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ToolInputError(`"${text}" is not a CIDR or a start-end range.`);
  }
  const start = parseIpv6(parts[0]);
  const end = parseIpv6(parts[1]);
  if (compareIpv6(start, end) > 0) throw new ToolInputError('The start address must not be after the end address.');
  return [start, end];
}

function rethrow(error: unknown, range?: string): void {
  if (!isToolInputError(error)) return;
  if (range) throw new ToolInputError(`${range}: ${error.message}`);
  throw error;
}
