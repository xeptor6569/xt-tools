import { dereference, format, validate, type OutputUnit, type Schema, type SchemaDraft } from '@cfworker/json-schema';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_DEPTH = 200;
/** Most rows shown in the error table. */
export const MAX_ERRORS = 1000;

export type { SchemaDraft };
export const DRAFTS: readonly SchemaDraft[] = ['2020-12', '2019-09', '7', '4'];

function checkSize(text: string, what: string): void {
  if (text.length > MAX_INPUT) throw new ToolInputError(`${what} is too large (maximum 1 MB).`);
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^JSON\.parse: /, '') : String(error);
    throw new ToolInputError(`${what} is not valid JSON: ${message}`);
  }
}

// ---------------------------------------------------------------- generator

export type RequiredMode = 'present' | 'all' | 'none';

export interface GenerateOptions {
  /** "present": keys found in every sample object (default); "all": every key seen; "none": no `required`. */
  required?: RequiredMode;
  /** Add `"additionalProperties": false` to every object. */
  noAdditional?: boolean;
  /** Detect `format` (date-time, date, email, uuid, uri, ipv4) when every sample string matches. */
  formats?: boolean;
}

type JsonType = 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean' | 'null';
const TYPE_ORDER: readonly JsonType[] = ['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'];

interface Acc {
  types: Set<JsonType>;
  /** Formats every string seen so far matches; undefined before the first string. */
  formats: Set<string> | undefined;
  object: { total: number; props: Map<string, { acc: Acc; count: number }> } | undefined;
  items: Acc | undefined;
}

const newAcc = (): Acc => ({ types: new Set(), formats: undefined, object: undefined, items: undefined });

const FORMAT_CHECKS: ReadonlyArray<[string, RegExp]> = [
  ['date-time', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/i],
  ['date', /^\d{4}-\d\d-\d\d$/],
  ['email', /^[^\s@]+@[^\s@.]+\.[^\s@]+$/],
  ['uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i],
  ['uri', /^[a-z][a-z0-9+.-]*:\/\/\S+$/i],
  ['ipv4', /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/],
];

/** Formats a string matches. The quick regex comes first; the validator's own check confirms it. */
export function detectFormats(text: string): Set<string> {
  const found = new Set<string>();
  if (text.length > 2048) return found;
  for (const [name, re] of FORMAT_CHECKS) if (re.test(text) && format[name]?.(text) !== false) found.add(name);
  return found;
}

function add(acc: Acc, value: unknown, detect: boolean, depth: number): void {
  if (depth > MAX_DEPTH) throw new ToolInputError(`The JSON is nested too deeply (more than ${MAX_DEPTH} levels).`);
  if (value === null) acc.types.add('null');
  else if (typeof value === 'boolean') acc.types.add('boolean');
  else if (typeof value === 'number') acc.types.add(Number.isInteger(value) ? 'integer' : 'number');
  else if (typeof value === 'string') {
    acc.types.add('string');
    if (detect && (acc.formats === undefined || acc.formats.size > 0)) {
      const found = detectFormats(value);
      acc.formats = acc.formats === undefined ? found : new Set([...acc.formats].filter((f) => found.has(f)));
    }
  } else if (Array.isArray(value)) {
    acc.types.add('array');
    acc.items ??= newAcc();
    for (const item of value) add(acc.items, item, detect, depth + 1);
  } else if (typeof value === 'object') {
    acc.types.add('object');
    acc.object ??= { total: 0, props: new Map() };
    acc.object.total++;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      let prop = acc.object.props.get(key);
      if (!prop) {
        prop = { acc: newAcc(), count: 0 };
        acc.object.props.set(key, prop);
      }
      prop.count++;
      add(prop.acc, child, detect, depth + 1);
    }
  }
}

function toSchema(acc: Acc, options: GenerateOptions): Record<string, unknown> {
  const types = new Set(acc.types);
  if (types.has('integer') && types.has('number')) types.delete('integer');
  const list = TYPE_ORDER.filter((t) => types.has(t));
  const schema: Record<string, unknown> = {};
  if (list.length === 1) schema.type = list[0];
  else if (list.length > 1) schema.type = list;
  if (types.has('string') && acc.formats?.size) schema.format = [...acc.formats][0];
  if (acc.object) {
    const { total, props } = acc.object;
    const properties: Record<string, unknown> = {};
    for (const [key, prop] of props) properties[key] = toSchema(prop.acc, options);
    schema.properties = properties;
    const mode = options.required ?? 'present';
    const required = mode === 'none' ? [] : [...props].filter(([, p]) => mode === 'all' || p.count === total);
    if (required.length) schema.required = required.map(([key]) => key);
    if (options.noAdditional) schema.additionalProperties = false;
  }
  if (acc.items && acc.items.types.size > 0) schema.items = toSchema(acc.items, options);
  return schema;
}

/** Infers a starting JSON Schema from a sample document. Empty input gives empty output. */
export function generateSchema(input: string, options: GenerateOptions = {}): string {
  checkSize(input, 'The JSON');
  if (input.trim() === '') return '';
  const value = parseJson(input, 'The JSON');
  const acc = newAcc();
  add(acc, value, options.formats ?? true, 0);
  return JSON.stringify(toSchema(acc, options), null, 2);
}

// ---------------------------------------------------------------- validator

export interface ValidationRow {
  /** JSON Pointer into the instance ("" is the whole document). */
  instance: string;
  keyword: string;
  /** Location of the failing keyword in the schema, as a URI fragment. */
  schemaLocation: string;
  message: string;
  /** A wrapper such as "A subschema had errors." that is followed by the detailed errors. */
  summary: boolean;
}

export interface ValidationReport {
  valid: boolean;
  draft: SchemaDraft;
  /** True when the draft came from the schema's `$schema`. */
  fromSchema: boolean;
  notes: string[];
  errors: ValidationRow[];
  /** Number of errors before the row limit. */
  total: number;
}

/** Maps a `$schema` URI to the draft it names. Draft 6 is checked with draft 7 rules. */
export function draftFromUri(uri: string): { draft: SchemaDraft; note?: string } | undefined {
  if (/\/draft\/2020-12\/schema\b/.test(uri)) return { draft: '2020-12' };
  if (/\/draft\/2019-09\/schema\b/.test(uri)) return { draft: '2019-09' };
  if (/\/draft-07\/schema\b/.test(uri)) return { draft: '7' };
  if (/\/draft-06\/schema\b/.test(uri))
    return { draft: '7', note: 'Draft 6 is checked with draft 7 rules (they differ only in minor details).' };
  if (/\/draft-04\/schema\b/.test(uri)) return { draft: '4' };
  return undefined;
}

// Base URI for resolving `$id` and `$ref`. Nothing is ever fetched: unknown references are errors.
const BASE_URI = new URL('xt-schema://local/schema.json');

const SUMMARY = [
  /^A subschema had errors\.$/,
  /^Property ".*" does not match (?:additional properties |unevaluated properties )?schema\.$/s,
  /^Property ".*" matches pattern ".*" but does not match associated schema\.$/s,
  /^Items did not match (?:additional items |unevaluated items )?schema\.$/,
  /^Instance does not match every subschema\.$/,
];

function decodeLocation(location: string): string {
  const pointer = location.replace(/^#/, '');
  try {
    return decodeURI(pointer);
  } catch {
    return pointer;
  }
}

const encodeSegment = (s: string) => encodeURI(s.replace(/~/g, '~0').replace(/\//g, '~1'));

/**
 * Cleans up the validator's raw output: drops false "additional property" reports for
 * properties that are declared but failed, and gives `false`-schema errors a real location.
 */
export function tidyErrors(raw: readonly OutputUnit[]): ValidationRow[] {
  const failedProps = new Set<string>();
  for (const e of raw) {
    const m =
      /^Property "(.*)" (?:does not match schema|matches pattern ".*" but does not match associated schema)\.$/s.exec(
        e.error,
      );
    if (m)
      failedProps.add(
        `${e.instanceLocation}\n${e.keywordLocation.replace(/\/(?:pattern)?[pP]roperties$/, '')}\n${m[1]}`,
      );
  }
  const rows: ValidationRow[] = [];
  let skipUnder: string | undefined;
  for (const [i, e] of raw.entries()) {
    if (skipUnder !== undefined) {
      if (e.instanceLocation === skipUnder || e.instanceLocation.startsWith(`${skipUnder}/`)) continue;
      skipUnder = undefined;
    }
    const extra = /^Property "(.*)" does not match additional properties schema\.$/s.exec(e.error);
    if (extra) {
      const key = extra[1] as string;
      const parent = e.keywordLocation.replace(/\/additionalProperties$/, '');
      if (failedProps.has(`${e.instanceLocation}\n${parent}\n${key}`)) {
        skipUnder = `${e.instanceLocation}/${encodeSegment(key)}`;
        continue;
      }
    }
    let { keyword, keywordLocation, error } = e;
    const prev = raw[i - 1];
    if (keyword === 'false' && prev && SUMMARY.some((re) => re.test(prev.error))) {
      keyword = prev.keyword;
      keywordLocation = prev.keywordLocation;
      const prop = /^Property "(.*)" does not match/s.exec(prev.error)?.[1];
      if (prev.keyword === 'properties' && prop !== undefined) {
        keywordLocation += `/${encodeSegment(prop)}`;
        error = `Property "${prop}" is not allowed (its schema is false).`;
      } else if (prop !== undefined) error = `Property "${prop}" is not allowed (${prev.keyword} is false).`;
      else error = `Item is not allowed (${prev.keyword} is false).`;
    }
    rows.push({
      instance: decodeLocation(e.instanceLocation),
      keyword,
      schemaLocation: keywordLocation,
      message: error,
      summary: SUMMARY.some((re) => re.test(error)),
    });
  }
  return rows;
}

function schemaError(error: unknown): ToolInputError {
  if (error instanceof RangeError)
    return new ToolInputError(
      'The schema recurses without end (for example a $ref that points to itself) or the JSON is nested too deeply.',
    );
  const message = error instanceof Error ? error.message : String(error);
  const unresolved = /^Unresolved \$ref "([^"]*)"/.exec(message);
  if (unresolved)
    return new ToolInputError(
      `Unresolved $ref "${unresolved[1]}". Only references inside this schema can be resolved; nothing is downloaded.`,
    );
  return new ToolInputError(`The schema can't be applied: ${message.split('\n')[0]}`);
}

/** Validates a JSON document against a schema and reports every error. */
export function validateJson(input: string, schemaText: string, selected: SchemaDraft = '2020-12'): ValidationReport {
  checkSize(input, 'The JSON');
  checkSize(schemaText, 'The schema');
  if (schemaText.trim() === '') throw new ToolInputError('Enter a schema to validate against.');
  const schema = parseJson(schemaText, 'The schema');
  if (typeof schema !== 'boolean' && (schema === null || typeof schema !== 'object' || Array.isArray(schema)))
    throw new ToolInputError('The schema must be a JSON object (or true/false).');
  if (input.trim() === '') throw new ToolInputError('Enter the JSON document to validate.');
  const instance = parseJson(input, 'The JSON');

  const notes: string[] = [];
  let draft = selected;
  let fromSchema = false;
  const declared = typeof schema === 'object' ? (schema as Schema).$schema : undefined;
  if (typeof declared === 'string') {
    const found = draftFromUri(declared);
    if (found) {
      draft = found.draft;
      fromSchema = true;
      if (found.note) notes.push(found.note);
    } else notes.push(`Unrecognised $schema "${declared}"; using the selected draft.`);
  }

  let result;
  try {
    const lookup = dereference(schema as Schema, Object.create(null) as Record<string, Schema | boolean>, BASE_URI);
    result = validate(instance, schema as Schema, draft, lookup, false);
  } catch (error) {
    throw schemaError(error);
  }
  const errors = tidyErrors(result.errors);
  return {
    valid: result.valid,
    draft,
    fromSchema,
    notes,
    errors: errors.slice(0, MAX_ERRORS),
    total: errors.length,
  };
}

export const DRAFT_LABELS: Record<SchemaDraft, string> = {
  '2020-12': 'Draft 2020-12',
  '2019-09': 'Draft 2019-09',
  '7': 'Draft 7',
  '4': 'Draft 4',
};
