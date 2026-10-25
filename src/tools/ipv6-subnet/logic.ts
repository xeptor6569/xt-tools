import { expandIpv6, formatIpv6, lastAddress, networkAddress, parseIpv6Prefix } from '../../lib/ipv6.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface Variant {
  label: string;
  value: string;
}

/** Compress, expand, and show the network, first, and last address of an IPv6 prefix. */
export function ipv6Subnet(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return [];
  const { address, prefix } = parseIpv6Prefix(input);
  const network = networkAddress(address, prefix);
  const last = lastAddress(address, prefix);
  return [
    { label: 'Compressed', value: formatIpv6(address) },
    { label: 'Expanded', value: expandIpv6(address) },
    { label: 'Prefix length', value: `/${prefix}` },
    { label: 'Network', value: `${formatIpv6(network)}/${prefix}` },
    { label: 'First address', value: formatIpv6(network) },
    { label: 'Last address', value: formatIpv6(last) },
  ];
}
