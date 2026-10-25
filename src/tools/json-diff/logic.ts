import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_DEPTH = 64;

interface Change {
  path: string;
  line: string;
}

function parseSide(text: string, side: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ToolInputError(`The ${side} value is not valid JSON.`);
  }
}

function pointer(path: string, key: string): string {
  return `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

function walk(before: unknown, after: unknown, path: string, out: Change[], depth: number): void {
  if (depth > MAX_DEPTH) throw new ToolInputError('The JSON is nested too deeply to compare.');
  if (Object.is(before, after)) return;
  if (isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const next = pointer(path, key);
      const hasBefore = Object.prototype.hasOwnProperty.call(before, key);
      const hasAfter = Object.prototype.hasOwnProperty.call(after, key);
      if (!hasBefore) out.push({ path: next, line: `added ${next}: ${JSON.stringify(after[key])}` });
      else if (!hasAfter) out.push({ path: next, line: `removed ${next}: ${JSON.stringify(before[key])}` });
      else walk(before[key], after[key], next, out, depth + 1);
    }
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const count = Math.max(before.length, after.length);
    for (let i = 0; i < count; i++) {
      const next = `${path}/${i}`;
      if (i >= before.length) out.push({ path: next, line: `added ${next}: ${JSON.stringify(after[i])}` });
      else if (i >= after.length) out.push({ path: next, line: `removed ${next}: ${JSON.stringify(before[i])}` });
      else walk(before[i], after[i], next, out, depth + 1);
    }
    return;
  }
  const at = path || '/';
  out.push({ path: at, line: `changed ${at}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}` });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function splitSides(input: string): [string, string] | undefined {
  const lines = input.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim() === '---');
  if (index < 0) return undefined;
  return [lines.slice(0, index).join('\n'), lines.slice(index + 1).join('\n')];
}

/**
 * Compare two JSON values separated by a line that contains only `---`.
 * The result is a stable list of added, removed and changed paths.
 */
export function jsonDiff(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const sides = splitSides(input);
  if (!sides) throw new ToolInputError('Separate the two JSON values with a line that contains only ---.');
  const before = parseSide(sides[0], 'first');
  const after = parseSide(sides[1], 'second');
  const changes: Change[] = [];
  walk(before, after, '', changes, 0);
  if (changes.length === 0) return 'No differences.';
  changes.sort((a, b) => a.path.localeCompare(b.path) || a.line.localeCompare(b.line));
  return changes.map((change) => change.line).join('\n');
}
