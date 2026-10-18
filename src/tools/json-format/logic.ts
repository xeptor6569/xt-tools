import { ToolInputError } from '../types.ts';

export type Indent = '2' | '4' | 'tab' | 'minify';

export interface JsonFormatOptions {
  indent?: Indent;
  sortKeys?: boolean;
}

export interface JsonFormatResult {
  text: string;
  warnings: string[];
}

const MAX_INPUT = 10_000_000;

// JSON.rawJSON and the reviver `context.source` argument keep big numbers
// exact (supported by current Chrome, Firefox, Safari and Node).
interface RawJsonApi {
  rawJSON?: (text: string) => unknown;
  isRawJSON?: (value: unknown) => boolean;
}
const raw = JSON as unknown as RawJsonApi;

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object' && !raw.isRawJSON?.(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortDeep((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Pretty-prints or minifies JSON. Big integers and long decimals are kept exactly when the runtime allows. */
export function jsonFormat(
  input: string,
  { indent = '2', sortKeys = false }: JsonFormatOptions = {},
): JsonFormatResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 10 MB).');
  if (input.trim() === '') return { text: '', warnings: [] };

  const warnings: string[] = [];
  let lossy = false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input, function (this: unknown, _key: string, value: unknown, context?: { source?: string }) {
      if (typeof value !== 'number' || !context?.source || String(value) === context.source) return value;
      // Keep the original number text (exact digits, exponent form).
      if (raw.rawJSON) return raw.rawJSON(context.source);
      if (/\d{16,}/.test(context.source.replace(/[-+.eE]/g, ''))) lossy = true;
      return value;
    } as (key: string, value: unknown) => unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^JSON\.parse: /, '') : String(error);
    throw new ToolInputError(`Invalid JSON: ${message}`);
  }
  if (lossy)
    warnings.push('Some numbers are too large or precise for this browser to keep exactly; they were rounded.');

  const value = sortKeys ? sortDeep(parsed) : parsed;
  const space = indent === 'minify' ? undefined : indent === 'tab' ? '\t' : Number(indent);
  return { text: JSON.stringify(value, null, space), warnings };
}
