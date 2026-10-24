import { ToolInputError } from '../types.ts';
import { KNOWN_PORTS, type KnownPort } from './data.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export type PortRange = 'registered' | 'dynamic' | 'unprivileged' | 'custom';

export const RANGES: Record<Exclude<PortRange, 'custom'>, { min: number; max: number }> = {
  registered: { min: 1024, max: 49151 },
  dynamic: { min: 49152, max: 65535 },
  unprivileged: { min: 1024, max: 65535 },
};

export const MAX_COUNT = 1000;
export const MIN_PORT = 1;
export const MAX_PORT = 65535;

export interface PortOptions {
  range: PortRange;
  /** Custom bounds, used when `range` is 'custom'. */
  min?: number;
  max?: number;
  /** Skip the curated list of well-known and common development ports. */
  skipKnown: boolean;
  /** Extra ports to avoid. */
  exclude?: ReadonlySet<number>;
  /** Sort the result ascending instead of keeping draw order. */
  sort?: boolean;
}

/** Parses the "how many" field. */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > MAX_COUNT) throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  return n;
}

/** Parses one port number field, e.g. the custom minimum. */
export function parsePort(text: string, label: string): number {
  const trimmed = text.trim();
  if (!/^\d{1,5}$/.test(trimmed)) throw new ToolInputError(`${label}: enter a port number from 1 to 65535.`);
  const n = Number(trimmed);
  if (n < MIN_PORT || n > MAX_PORT) throw new ToolInputError(`${label}: enter a port number from 1 to 65535.`);
  return n;
}

/** Parses a list of ports and ranges to avoid, e.g. "8001, 8100-8199 9999". */
export function parseExclusions(text: string): Set<number> {
  if (text.length > 10_000) throw new ToolInputError('The exclusion list is too long (maximum 10,000 characters).');
  // A bitmap keeps overlapping ranges cheap; it's turned into a set once at the end.
  const bitmap = new Uint8Array(MAX_PORT + 1);
  let any = false;
  for (const token of text.split(/[\s,;]+/)) {
    if (token === '') continue;
    const m = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(token);
    if (!m) throw new ToolInputError(`“${token.slice(0, 20)}” is not a port or a range like 8000-8100.`);
    const a = parsePort(m[1]!, 'Exclude');
    const b = m[2] === undefined ? a : parsePort(m[2], 'Exclude');
    if (b < a) throw new ToolInputError(`The range ${token} runs backwards.`);
    bitmap.fill(1, a, b + 1);
    any = true;
  }
  const out = new Set<number>();
  if (any) for (let p = MIN_PORT; p <= MAX_PORT; p++) if (bitmap[p]) out.add(p);
  return out;
}

/** Resolves the bounds for the chosen range. */
export function rangeBounds(options: Pick<PortOptions, 'range' | 'min' | 'max'>): { min: number; max: number } {
  if (options.range !== 'custom') return RANGES[options.range];
  const { min, max } = options;
  if (min === undefined || max === undefined) throw new ToolInputError('Enter a minimum and a maximum port.');
  if (min > max) throw new ToolInputError('The minimum port must not be greater than the maximum.');
  return { min, max };
}

/** The curated ports that fall inside [min, max]. */
export function knownPortsIn(min: number, max: number): KnownPort[] {
  return KNOWN_PORTS.filter((k) => k.port >= min && k.port <= max);
}

/**
 * Returns an unbiased random integer in [0, n) for n ≤ 65536, by rejection
 * sampling over 16-bit values drawn from `random`.
 */
export function uniformBelow(n: number, random: RandomBytes): number {
  if (!Number.isInteger(n) || n < 1 || n > 65536) throw new RangeError(`uniformBelow: bad bound ${n}`);
  const limit = 65536 - (65536 % n);
  // With a real random source the chance of rejecting 200 draws in a row is below 2^-200.
  for (let attempt = 0; attempt < 200; attempt++) {
    const bytes = random(2);
    const v = ((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0);
    if (v < limit) return v % n;
  }
  throw new Error('The random source keeps returning out-of-range values.');
}

/**
 * Picks `count` unique random ports. The candidates are every port in the
 * range minus the skipped ones; a partial Fisher–Yates shuffle with unbiased
 * indices then picks from them, so each port is equally likely.
 */
export function randomPorts(count: number, options: PortOptions, random: RandomBytes): number[] {
  const { min, max } = rangeBounds(options);
  const skip = new Set<number>(options.exclude ?? []);
  if (options.skipKnown) for (const k of knownPortsIn(min, max)) skip.add(k.port);

  const candidates: number[] = [];
  for (let p = min; p <= max; p++) if (!skip.has(p)) candidates.push(p);
  if (candidates.length < count) {
    const skipped = max - min + 1 - candidates.length;
    throw new ToolInputError(
      `The range ${min}–${max} only has ${candidates.length} usable port${candidates.length === 1 ? '' : 's'}` +
        (skipped > 0 ? ` (${skipped} skipped)` : '') +
        `, fewer than the ${count} requested.`,
    );
  }

  for (let i = 0; i < count; i++) {
    const j = i + uniformBelow(candidates.length - i, random);
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  const picked = candidates.slice(0, count);
  return options.sort ? picked.sort((a, b) => a - b) : picked;
}
