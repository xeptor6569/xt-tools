import {
  aggregateBlocks,
  blockContainsBlock,
  blockEnd,
  formatCidr,
  parseCidr,
  type Ipv4Block,
} from '../../lib/ipv4.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_PREFIXES = 10_000;

/** Aggregate CIDR prefixes and list containments and duplicate lines. */
export function cidrTools(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const blocks = parseLines(input);
  if (blocks.length === 0) return '';
  const aggregated = aggregateBlocks(blocks)
    .map((block) => formatCidr(block))
    .join('\n');
  const overlaps = overlapLines(blocks);
  return `Aggregated\n${aggregated}\n\nOverlaps\n${overlaps.length > 0 ? overlaps.join('\n') : 'None'}`;
}

function parseLines(input: string): Ipv4Block[] {
  const lines = input.split(/\r?\n/);
  const blocks: Ipv4Block[] = [];
  for (const [index, raw] of lines.entries()) {
    const line = raw.replace(/#.*/, '').trim();
    if (line === '') continue;
    if (blocks.length >= MAX_PREFIXES) {
      throw new ToolInputError(`Enter at most ${MAX_PREFIXES} prefixes.`);
    }
    try {
      blocks.push(parseCidr(line));
    } catch (error) {
      if (error instanceof ToolInputError) {
        throw new ToolInputError(`Line ${index + 1}: ${error.message}`);
      }
      throw error;
    }
  }
  return blocks;
}

function overlapLines(blocks: readonly Ipv4Block[]): string[] {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    const text = formatCidr(block);
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  const lines: string[] = [];
  for (const [text, count] of counts) {
    if (count > 1) lines.push(`${text} listed ${count} times`);
  }
  const unique: Ipv4Block[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const text = formatCidr(block);
    if (seen.has(text)) continue;
    seen.add(text);
    unique.push(block);
  }
  unique.sort((a, b) => a.start - b.start || a.prefix - b.prefix);
  const open: Ipv4Block[] = [];
  for (const block of unique) {
    const still: Ipv4Block[] = [];
    for (const outer of open) {
      if (blockEnd(outer) < block.start) continue;
      still.push(outer);
      if (blockContainsBlock(outer, block) && (outer.start !== block.start || outer.prefix !== block.prefix)) {
        lines.push(`${formatCidr(outer)} contains ${formatCidr(block)}`);
      }
    }
    still.push(block);
    open.length = 0;
    open.push(...still);
  }
  lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return lines;
}
