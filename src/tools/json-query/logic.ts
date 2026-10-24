import { JSONPath } from 'jsonpath-plus';
import { ToolInputError } from '../types.ts';
import { DEFAULT_MAX_RESULTS } from './limits.ts';

export { DEFAULT_MAX_RESULTS, MAX_RESULT_OPTIONS } from './limits.ts';

const MAX_INPUT = 10_000_000;
const MAX_PATH = 10_000;
/** Stop collecting once the pretty-printed matches exceed this many characters. */
const MAX_OUTPUT = 2_000_000;
const PREVIEW = 120;

export interface QueryMatch {
  /** Normalized JSONPath (RFC 9535 style), e.g. $['store']['book'][0]. */
  path: string;
  /** JSON Pointer (RFC 6901), e.g. /store/book/0. */
  pointer: string;
  /** Compact, shortened JSON of the value. */
  preview: string;
}

export interface QueryResult {
  /** Pretty-printed JSON array of the matched values. */
  text: string;
  matches: QueryMatch[];
  /** True when more matches exist than were collected. */
  truncated: boolean;
}

const STOP = Symbol('stop');

const ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  "'": "\\'",
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/** Escapes a member name for a normalized path. */
function nameSelector(name: string): string {
  let out = '';
  for (const ch of name) {
    const code = ch.codePointAt(0) as number;
    out += ESCAPES[ch] ?? (code < 0x20 ? `\\u${code.toString(16).padStart(4, '0')}` : ch);
  }
  return `['${out}']`;
}

const pointerSegment = (s: string) => `/${s.replace(/~/g, '~0').replace(/\//g, '~1')}`;

/**
 * jsonpath-plus reports paths as strings like $['a']['it\'s'][0]. Splits one back into
 * segments and walks the document, so numeric object keys and array indexes are told apart.
 */
export function describePath(path: string, root: unknown): { path: string; pointer: string } {
  let normalized = '$';
  let pointer = '';
  let current: unknown = root;
  for (const m of path.matchAll(/\[(?:(\d+|\*)|'((?:[^'\\]|\\.)*)')\]/g)) {
    const segment = m[1] ?? (m[2] ?? '').replace(/\\(.)/g, '$1');
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      normalized += `[${segment}]`;
      current = current[Number(segment)];
    } else {
      normalized += nameSelector(segment);
      current =
        current !== null && typeof current === 'object' && Object.hasOwn(current, segment)
          ? (current as Record<string, unknown>)[segment]
          : undefined;
    }
    pointer += pointerSegment(segment);
  }
  return { path: normalized, pointer };
}

function parseDocument(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^JSON\.parse: /, '') : String(error);
    throw new ToolInputError(`Invalid JSON: ${message}`);
  }
}

/**
 * Evaluates a JSONPath expression against a JSON document with jsonpath-plus. Filter
 * expressions run in its safe evaluator (no eval). Empty input gives an empty result.
 */
export function jsonQuery(input: string, expression: string, maxResults: number = DEFAULT_MAX_RESULTS): QueryResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('The JSON is too large (maximum 10 MB).');
  if (expression.length > MAX_PATH) throw new ToolInputError('The JSONPath expression is too long.');
  if (input.trim() === '') return { text: '', matches: [], truncated: false };
  const json = parseDocument(input);
  const path = expression.trim();
  if (path === '') throw new ToolInputError('Enter a JSONPath expression, for example $..* or $.store.book[0].');
  const limit = Math.max(1, Math.floor(maxResults) || DEFAULT_MAX_RESULTS);

  const values: string[] = [];
  const matches: QueryMatch[] = [];
  let size = 0;
  let truncated = false;
  try {
    JSONPath({
      path,
      json: json as object,
      eval: 'safe',
      resultType: 'value',
      wrap: true,
      callback: (value: unknown, _type: unknown, full: { path: unknown }) => {
        if (matches.length >= limit || size > MAX_OUTPUT) {
          truncated = true;
          throw STOP;
        }
        const pretty = JSON.stringify(value, null, 2) ?? 'null';
        size += pretty.length;
        values.push(pretty);
        const flat = pretty.length > 4 * PREVIEW ? pretty.slice(0, 4 * PREVIEW) : pretty;
        const compact = flat.replace(/\n\s*/g, ' ');
        matches.push({
          ...describePath(typeof full.path === 'string' ? full.path : '$', json),
          preview: compact.length > PREVIEW ? `${compact.slice(0, PREVIEW)}…` : compact,
        });
      },
    });
  } catch (error) {
    if (error !== STOP) {
      if (error instanceof RangeError) throw new ToolInputError('The JSON is nested too deeply for this query.');
      const message = error instanceof Error ? error.message.replace(/^jsonPath: /, '') : String(error);
      throw new ToolInputError(`Invalid JSONPath expression: ${message}`);
    }
  }
  const text = values.length === 0 ? '[]' : `[\n${values.map((v) => `  ${v.replace(/\n/g, '\n  ')}`).join(',\n')}\n]`;
  return { text, matches, truncated };
}
