import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

export interface Subnet {
  address: number;
  prefix: number;
}

const MAX_INPUT = 200;

export function parseIpv4(text: string): number {
  const parts = text.trim().split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) {
    throw new ToolInputError(`"${text.trim()}" is not a valid IPv4 address.`);
  }
  if (parts.some((p) => p.length > 1 && p.startsWith('0'))) {
    throw new ToolInputError(`"${text.trim()}" has leading zeros, which some systems read as octal. Remove them.`);
  }
  return parts.reduce((acc, p) => acc * 256 + Number(p), 0);
}

export function formatIpv4(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

export function maskFromPrefix(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

function prefixFromMask(mask: number): number {
  const prefix = 32 - Math.log2(((~mask >>> 0) + 1) >>> 0 || 2 ** 32);
  if (!Number.isInteger(prefix) || maskFromPrefix(prefix) !== mask) {
    throw new ToolInputError(`${formatIpv4(mask)} is not a valid subnet mask (its 1-bits must be contiguous).`);
  }
  return prefix;
}

/** Accepts "10.0.0.1/8", "10.0.0.1 255.0.0.0", "10.0.0.1/255.0.0.0" or a bare address (/32). */
export function parseSubnet(input: string): Subnet {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too long.');
  const [addr = '', mask] = input.trim().split(/\s*\/\s*|\s+/);
  const address = parseIpv4(addr);
  if (mask === undefined || mask === '') return { address, prefix: 32 };
  if (/^\d{1,2}$/.test(mask)) {
    const prefix = Number(mask);
    if (prefix > 32) throw new ToolInputError('The prefix length must be between 0 and 32.');
    return { address, prefix };
  }
  return { address, prefix: prefixFromMask(parseIpv4(mask)) };
}

function addressType(n: number): string {
  const inRange = (base: string, prefix: number) => (n & maskFromPrefix(prefix)) >>> 0 === parseIpv4(base);
  if (inRange('0.0.0.0', 8)) return 'This network (RFC 1122)';
  if (inRange('10.0.0.0', 8) || inRange('172.16.0.0', 12) || inRange('192.168.0.0', 16)) return 'Private (RFC 1918)';
  if (inRange('100.64.0.0', 10)) return 'Carrier-grade NAT (RFC 6598)';
  if (inRange('127.0.0.0', 8)) return 'Loopback';
  if (inRange('169.254.0.0', 16)) return 'Link-local';
  if (inRange('192.0.2.0', 24) || inRange('198.51.100.0', 24) || inRange('203.0.113.0', 24)) {
    return 'Documentation (RFC 5737)';
  }
  if (inRange('198.18.0.0', 15)) return 'Benchmarking (RFC 2544)';
  if (inRange('224.0.0.0', 4)) return 'Multicast';
  if (n === 0xffffffff) return 'Limited broadcast';
  if (inRange('240.0.0.0', 4)) return 'Reserved';
  return 'Public';
}

function addressClass(n: number): string {
  const first = n >>> 24;
  if (first < 128) return 'A';
  if (first < 192) return 'B';
  if (first < 224) return 'C';
  if (first < 240) return 'D (multicast)';
  return 'E (reserved)';
}

const binary = (n: number) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.');
const count = (n: number) => n.toLocaleString('en-US');

export function ipv4Subnet(input: string): Variant[] {
  if (input.trim() === '') return [];
  const { address, prefix } = parseSubnet(input);
  const mask = maskFromPrefix(prefix);
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  // RFC 3021: /31 links use both addresses; /32 is a single host.
  const [first, last, usable] = prefix >= 31 ? [network, broadcast, total] : [network + 1, broadcast - 1, total - 2];

  return [
    { label: 'Address', value: formatIpv4(address) },
    { label: 'CIDR notation', value: `${formatIpv4(network)}/${prefix}` },
    { label: 'Subnet mask', value: formatIpv4(mask) },
    { label: 'Wildcard mask', value: formatIpv4(~mask >>> 0) },
    { label: 'Network address', value: formatIpv4(network) },
    { label: 'Broadcast address', value: prefix >= 31 ? 'None (point-to-point or host route)' : formatIpv4(broadcast) },
    { label: 'Usable host range', value: `${formatIpv4(first)} – ${formatIpv4(last)}` },
    { label: 'Usable hosts', value: count(usable) },
    { label: 'Total addresses', value: count(total) },
    { label: 'Address type', value: addressType(address) },
    { label: 'Class (historical)', value: addressClass(address) },
    { label: 'Address in binary', value: binary(address) },
    { label: 'Mask in binary', value: binary(mask) },
    { label: 'Address in hex', value: `0x${address.toString(16).padStart(8, '0').toUpperCase()}` },
    { label: 'Address as integer', value: String(address) },
  ];
}
