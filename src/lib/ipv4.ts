// Shared IPv4 parsing and CIDR arithmetic for the network tools.
import { ToolInputError } from '../tools/types.ts';

export interface Ipv4Block {
  start: number;
  prefix: number;
}

const MAX_U32 = 0xffffffff;

export function parseIpv4(text: string): number {
  const trimmed = text.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new ToolInputError(`"${trimmed}" is not a valid IPv4 address.`);
  }
  if (parts.some((part) => part.length > 1 && part.startsWith('0'))) {
    throw new ToolInputError(`"${trimmed}" has leading zeros. Write each octet in decimal without them.`);
  }
  return parts.reduce((acc, part) => acc * 256 + Number(part), 0);
}

export function formatIpv4(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_U32) throw new ToolInputError('IPv4 number out of range.');
  return [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
}

export function maskFromPrefix(prefix: number): number {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new ToolInputError('The prefix length must be between 0 and 32.');
  }
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** Prefix length of a contiguous mask, or throws when the 1-bits are not a prefix. */
export function prefixFromMask(mask: number): number {
  const host = (~mask >>> 0) + 1;
  const span = host >>> 0 === 0 ? 2 ** 32 : host >>> 0;
  const prefix = 32 - Math.round(Math.log2(span));
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32 || maskFromPrefix(prefix) !== mask >>> 0) {
    throw new ToolInputError(`${formatIpv4(mask >>> 0)} is not a contiguous prefix mask.`);
  }
  return prefix;
}

export function formatCidr(block: Ipv4Block): string {
  return `${formatIpv4(block.start)}/${block.prefix}`;
}

export function blockSize(prefix: number): number {
  return 2 ** (32 - prefix);
}

export function blockEnd(block: Ipv4Block): number {
  return block.start + blockSize(block.prefix) - 1;
}

/** Network address of `addr/prefix`. */
export function normalizeBlock(addr: number, prefix: number): Ipv4Block {
  const size = blockSize(prefix);
  const start = addr - (addr % size);
  return { start, prefix };
}

export function parseCidr(text: string): Ipv4Block {
  const trimmed = text.trim();
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0)
    throw new ToolInputError(`"${trimmed}" is not a CIDR prefix. Use an address and a length, like 10.0.0.0/8.`);
  const prefixText = trimmed.slice(slash + 1).trim();
  if (!/^\d{1,2}$/.test(prefixText) || Number(prefixText) > 32) {
    throw new ToolInputError(`"${trimmed}" has a prefix length outside 0–32.`);
  }
  return normalizeBlock(parseIpv4(trimmed.slice(0, slash)), Number(prefixText));
}

export function blockContainsIp(block: Ipv4Block, ip: number): boolean {
  return ip >= block.start && ip <= blockEnd(block);
}

export function blockContainsBlock(outer: Ipv4Block, inner: Ipv4Block): boolean {
  return outer.start <= inner.start && blockEnd(outer) >= blockEnd(inner);
}

/** Minimal CIDR cover of an inclusive address range. */
export function rangeToCidrs(start: number, end: number): Ipv4Block[] {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > MAX_U32) {
    throw new ToolInputError('Address out of range.');
  }
  if (start > end) throw new ToolInputError('The start address must not be after the end address.');
  const blocks: Ipv4Block[] = [];
  let cursor = start;
  while (cursor <= end) {
    const remaining = end - cursor + 1;
    let size = 1;
    while (size * 2 <= remaining && cursor % (size * 2) === 0) size *= 2;
    blocks.push({ start: cursor, prefix: 32 - Math.round(Math.log2(size)) });
    if (size === 2 ** 32) break;
    cursor += size;
  }
  return blocks;
}

/** Drop blocks contained in an earlier one. Input need not be sorted. */
export function removeContained(blocks: readonly Ipv4Block[]): Ipv4Block[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.prefix - b.prefix);
  const kept: Ipv4Block[] = [];
  for (const block of sorted) {
    const end = blockEnd(block);
    const covered = kept.some(
      (outer) => outer.start <= block.start && blockEnd(outer) >= end && outer.prefix !== block.prefix,
    );
    const duplicate = kept.some((outer) => outer.start === block.start && outer.prefix === block.prefix);
    if (!covered && !duplicate) kept.push(block);
  }
  return kept;
}

/** Merge adjacent equal-length blocks into supernets. */
export function aggregateBlocks(blocks: readonly Ipv4Block[]): Ipv4Block[] {
  let current = removeContained(blocks);
  let changed = true;
  while (changed) {
    changed = false;
    const next: Ipv4Block[] = [];
    for (let i = 0; i < current.length; i++) {
      const left = current[i];
      const right = current[i + 1];
      if (
        left &&
        right &&
        left.prefix === right.prefix &&
        left.prefix > 0 &&
        left.start + blockSize(left.prefix) === right.start &&
        left.start % blockSize(left.prefix - 1) === 0
      ) {
        next.push({ start: left.start, prefix: left.prefix - 1 });
        i += 1;
        changed = true;
        continue;
      }
      if (left) next.push(left);
    }
    current = next;
  }
  return current;
}
