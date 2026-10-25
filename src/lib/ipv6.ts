// IPv6 parse and RFC 5952 text form.
import { ToolInputError } from '../tools/types.ts';

const HEX = /^[0-9a-f]{1,4}$/i;

export function parseIpv6(text: string): Uint8Array {
  let value = text.trim();
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
  if (value.length === 0 || value.length > 64)
    throw new ToolInputError(`"${text.trim()}" is not a valid IPv6 address.`);
  if (value.includes('%')) throw new ToolInputError(`"${value}" has a zone id. Remove the part after %.`);
  if (!/^[0-9a-f:.]+$/i.test(value)) throw new ToolInputError(`"${value}" is not a valid IPv6 address.`);
  const halves = value.split('::');
  if (halves.length > 2) throw new ToolInputError(`"${value}" has more than one "::".`);
  const left = parseSide(halves[0] ?? '', value);
  const right = halves.length === 2 ? parseSide(halves[1] ?? '', value) : [];
  let groups: number[];
  if (halves.length === 1) {
    if (left.length !== 8) throw new ToolInputError(`"${value}" must have 8 groups, or use "::" once.`);
    groups = left;
  } else {
    if (left.length + right.length > 7) throw new ToolInputError(`"${value}" has too many groups for "::".`);
    groups = [...left, ...Array.from({ length: 8 - left.length - right.length }, () => 0), ...right];
  }
  const out = new Uint8Array(16);
  groups.forEach((group, index) => {
    out[index * 2] = group >> 8;
    out[index * 2 + 1] = group & 0xff;
  });
  return out;
}

function parseSide(side: string, original: string): number[] {
  if (side === '') return [];
  const bits = side.split(':');
  const groups: number[] = [];
  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i] ?? '';
    if (bit.includes('.')) {
      if (i !== bits.length - 1) throw new ToolInputError(`"${original}" has an IPv4 tail in the middle.`);
      groups.push(...ipv4Groups(bit, original));
      continue;
    }
    if (!HEX.test(bit)) throw new ToolInputError(`"${original}" is not a valid IPv6 address.`);
    groups.push(Number.parseInt(bit, 16));
  }
  return groups;
}

function ipv4Groups(text: string, original: string): [number, number] {
  const parts = text.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new ToolInputError(`"${original}" has an invalid IPv4 tail.`);
  }
  if (parts.some((part) => part.length > 1 && part.startsWith('0'))) {
    throw new ToolInputError(`"${original}" has leading zeros in the IPv4 tail.`);
  }
  const bytes = parts.map(Number);
  const hi = ((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0);
  const lo = ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  return [hi, lo];
}

export function hextets(bytes: Uint8Array): number[] {
  if (bytes.length !== 16) throw new ToolInputError('An IPv6 address is 16 bytes.');
  const groups: number[] = [];
  for (let i = 0; i < 8; i++) groups.push(((bytes[i * 2] ?? 0) << 8) | (bytes[i * 2 + 1] ?? 0));
  return groups;
}

/** Fully padded 8-group form, lowercase. */
export function expandIpv6(bytes: Uint8Array): string {
  return hextets(bytes)
    .map((group) => group.toString(16).padStart(4, '0'))
    .join(':');
}

/**
 * RFC 5952: lowercase, no leading zeros, compress the longest run of two or
 * more zero groups, and the leftmost run when two are the same length.
 */
export function formatIpv6(bytes: Uint8Array): string {
  const groups = hextets(bytes);
  if (groups.every((group) => group === 0)) return '::';
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < groups.length;) {
    if (groups[i] !== 0) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < groups.length && groups[j] === 0) j += 1;
    if (j - i > bestLen) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }
  const compress = bestLen >= 2;
  const parts: string[] = [];
  for (let i = 0; i < groups.length;) {
    if (compress && i === bestStart) {
      parts.push('');
      i += bestLen;
      if (i >= groups.length) parts.push('');
      continue;
    }
    parts.push((groups[i] ?? 0).toString(16));
    i += 1;
  }
  let text = parts.join(':');
  if (compress && bestStart === 0) text = `:${text}`;
  return text;
}

export function parseIpv6Prefix(input: string): { address: Uint8Array; prefix: number } {
  const trimmed = input.trim();
  if (trimmed.length > 200) throw new ToolInputError('Input is too long.');
  const slash = trimmed.lastIndexOf('/');
  const addrText = slash === -1 ? trimmed : trimmed.slice(0, slash).trim();
  const prefixText = slash === -1 ? undefined : trimmed.slice(slash + 1).trim();
  const address = parseIpv6(addrText);
  if (prefixText === undefined) return { address, prefix: 128 };
  if (!/^\d{1,3}$/.test(prefixText)) throw new ToolInputError('The prefix length must be a number from 0 to 128.');
  const prefix = Number(prefixText);
  if (prefix > 128) throw new ToolInputError('The prefix length must be between 0 and 128.');
  return { address, prefix };
}

function applyPrefix(addr: Uint8Array, prefix: number, hostOnes: boolean): Uint8Array {
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const startBit = i * 8;
    const byte = addr[i] ?? 0;
    if (prefix >= startBit + 8) out[i] = byte;
    else if (prefix <= startBit) out[i] = hostOnes ? 0xff : 0;
    else {
      const keep = prefix - startBit;
      const bits = (0xff << (8 - keep)) & 0xff;
      out[i] = hostOnes ? (byte & bits) | (~bits & 0xff) : byte & bits;
    }
  }
  return out;
}

export function networkAddress(addr: Uint8Array, prefix: number): Uint8Array {
  return applyPrefix(addr, prefix, false);
}

export function lastAddress(addr: Uint8Array, prefix: number): Uint8Array {
  return applyPrefix(addr, prefix, true);
}

export function compareIpv6(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < 16; i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function ipv6Contains(network: Uint8Array, prefix: number, addr: Uint8Array): boolean {
  const base = networkAddress(network, prefix);
  const masked = networkAddress(addr, prefix);
  return compareIpv6(base, masked) === 0;
}
