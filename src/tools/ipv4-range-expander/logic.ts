import { formatCidr, parseIpv4, rangeToCidrs } from '../../lib/ipv4.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

/** Minimal CIDR cover of an inclusive start and end address. */
export function ipv4RangeExpander(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const match = trimmed.match(/^(\S+)\s*(?:-\s*|\s+)(\S+)$/);
  if (!match) {
    throw new ToolInputError('Enter a start and end address, for example 192.168.1.0 192.168.1.255.');
  }
  const start = parseIpv4(match[1] ?? '');
  const end = parseIpv4(match[2] ?? '');
  return rangeToCidrs(start, end)
    .map((block) => formatCidr(block))
    .join('\n');
}
