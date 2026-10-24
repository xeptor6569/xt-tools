import type SemVer from 'semver/classes/semver.js';
import SemverRange from 'semver/classes/range.js';
import compareBuild from 'semver/functions/compare-build.js';
import diff from 'semver/functions/diff.js';
import inc from 'semver/functions/inc.js';
import parse from 'semver/functions/parse.js';
import minVersion from 'semver/ranges/min-version.js';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_LINES = 10_000;
const MAX_RANGE = 1000;

export type Order = 'asc' | 'desc';

export interface ParseOptions {
  /** Accept sloppy versions such as "=1.2.3" or "1.2.3beta". */
  loose: boolean;
  /** Let ranges match prerelease versions of other tuples too. */
  includePrerelease: boolean;
}

export interface VersionEntry {
  line: number;
  text: string;
  /** Normalized version, e.g. "1.2.3" for "v1.2.3". */
  version: string;
  parsed: SemVer;
}

export interface InvalidEntry {
  line: number;
  text: string;
}

export interface SortResult {
  /** Valid versions in sorted order. */
  versions: VersionEntry[];
  invalid: InvalidEntry[];
  /** The sorted input lines, one per line. */
  text: string;
}

/** Parses one version per line and sorts the valid ones by semver precedence (then build metadata). */
export function sortVersions(input: string, order: Order, options: ParseOptions): SortResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const versions: VersionEntry[] = [];
  const invalid: InvalidEntry[] = [];
  const lines = input.split(/\r?\n/);
  if (lines.length > MAX_LINES) throw new ToolInputError(`Too many lines (maximum ${MAX_LINES.toLocaleString('en')}).`);
  lines.forEach((raw, i) => {
    const text = raw.trim();
    if (text === '') return;
    const parsed = parse(text, { loose: options.loose });
    if (parsed) versions.push({ line: i + 1, text, version: parsed.version, parsed });
    else invalid.push({ line: i + 1, text });
  });
  const sign = order === 'asc' ? 1 : -1;
  versions.sort((a, b) => sign * compareBuild(a.parsed, b.parsed) || a.line - b.line);
  return { versions, invalid, text: versions.map((v) => v.text).join('\n') };
}

export interface RangeResult {
  /** The range as semver normalizes it, e.g. ">=1.2.0 <2.0.0-0". */
  normalized: string;
  /** One entry per || alternative. */
  alternatives: string[];
  /** Lowest version that could ever match, or null when nothing can. */
  minVersion: string | null;
  /** The normalized versions from the list that satisfy the range, keyed by line. */
  matching: Set<number>;
  maxSatisfying: string | null;
  minSatisfying: string | null;
}

/** Parses an npm-style range and tests the versions against it. Returns null for an empty range. */
export function analyzeRange(range: string, versions: VersionEntry[], options: ParseOptions): RangeResult | null {
  if (range.length > MAX_RANGE) throw new ToolInputError(`The range is too long (maximum ${MAX_RANGE} characters).`);
  if (range.trim() === '') return null;
  let r: SemverRange;
  try {
    r = new SemverRange(range, options);
  } catch {
    throw new ToolInputError(
      `“${range.trim().slice(0, 60)}” is not a valid range. Try ^1.2.0, ~1.2, >=1.0.0 <2 or 1.x.`,
    );
  }
  const matching = new Set<number>();
  let max: SemVer | null = null;
  let min: SemVer | null = null;
  for (const v of versions) {
    if (!r.test(v.parsed)) continue;
    matching.add(v.line);
    if (!max || compareBuild(v.parsed, max) > 0) max = v.parsed;
    if (!min || compareBuild(v.parsed, min) < 0) min = v.parsed;
  }
  const normalized = r.range || '*';
  let lowest: SemVer | null;
  try {
    lowest = minVersion(r, options);
  } catch {
    lowest = null;
  }
  return {
    normalized,
    alternatives: r.set.map((set) => set.map((c) => c.value || '*').join(' ')),
    minVersion: lowest?.version ?? null,
    matching,
    maxSatisfying: max?.version ?? null,
    minSatisfying: min?.version ?? null,
  };
}

export interface Comparison {
  a: string;
  b: string;
  relation: '<' | '=' | '>';
  /** Which part differs: major, minor, patch, prerelease, … or null when equal. */
  difference: string | null;
  /** True when the versions have equal precedence but different build metadata. */
  buildDiffers: boolean;
}

function parseOne(text: string, label: string, loose: boolean): SemVer {
  if (text.length > 256) throw new ToolInputError(`${label} is too long for a version.`);
  const v = parse(text.trim(), { loose });
  if (!v) throw new ToolInputError(`${label}: “${text.trim().slice(0, 60)}” is not a valid semantic version.`);
  return v;
}

/** Compares two versions. Returns null if either is empty. */
export function compareVersions(a: string, b: string, loose: boolean): Comparison | null {
  if (a.trim() === '' || b.trim() === '') return null;
  const va = parseOne(a, 'Version A', loose);
  const vb = parseOne(b, 'Version B', loose);
  const cmp = va.compare(vb);
  return {
    a: va.version,
    b: vb.version,
    relation: cmp < 0 ? '<' : cmp > 0 ? '>' : '=',
    difference: diff(va, vb),
    buildDiffers: cmp === 0 && va.build.join('.') !== vb.build.join('.'),
  };
}

export interface Increment {
  label: string;
  value: string;
}

const INCREMENTS = [
  ['major', 'Next major'],
  ['minor', 'Next minor'],
  ['patch', 'Next patch'],
  ['premajor', 'Pre-major'],
  ['preminor', 'Pre-minor'],
  ['prepatch', 'Pre-patch'],
  ['prerelease', 'Next prerelease'],
  ['release', 'Release (drop prerelease)'],
] as const;

/** Every increment of a version. Returns null for an empty version. */
export function incrementVersion(version: string, preid: string, loose: boolean): Increment[] | null {
  if (version.trim() === '') return null;
  const v = parseOne(version, 'Version', loose);
  const id = preid.trim();
  if (id !== '' && !/^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/.test(id)) {
    throw new ToolInputError('The prerelease identifier may only use letters, digits, hyphens and dots.');
  }
  if (id.length > 100) throw new ToolInputError('The prerelease identifier is too long.');
  const out: Increment[] = [];
  for (const [type, label] of INCREMENTS) {
    if (type === 'release' && v.prerelease.length === 0) continue;
    const next = id === '' ? inc(v.version, type, { loose }) : inc(v.version, type, { loose }, id);
    if (next) out.push({ label, value: next });
  }
  return out;
}
