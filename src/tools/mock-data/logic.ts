// Pure logic for the mock data generator. The faker instance is injected, so
// this module never pulls faker into the page bundle and tests can use a
// seeded instance.
import type { Faker } from '@faker-js/faker';
import { writeCsv } from '../../lib/csv.ts';
import { ToolInputError } from '../types.ts';
import { findFieldType, type Value } from './fields.ts';

export const MAX_ROWS = 10_000;
export const MAX_FIELDS = 50;
export const MAX_NAME = 64;
/** Largest output, in UTF-16 code units, that a text area handles comfortably. */
export const MAX_OUTPUT = 25_000_000;

export type Format = 'json' | 'ndjson' | 'csv' | 'sql';
export type QuoteStyle = 'ansi' | 'mysql' | 'mssql';

export interface FieldSpec {
  name: string;
  type: string;
  /** Raw text of the type's parameters, by key. Missing keys use the default. */
  params?: Readonly<Record<string, string>>;
  /** Percentage of empty (null) values, as typed. Empty means 0. */
  empty?: string;
}

export interface Table {
  columns: string[];
  rows: Value[][];
}

export interface SqlOptions {
  table: string;
  quote: QuoteStyle;
  /** Rows per INSERT statement. */
  batch: number;
}

export interface MockRequest {
  fields: readonly FieldSpec[];
  count: string;
  /** 32-bit seed. */
  seed: number;
  /** Day (YYYY-MM-DD, as typed) that relative dates such as past, future and birth dates are based on. */
  refDate: string;
  format: Format;
  sql: SqlOptions;
}

export function parseCount(text: string): number {
  const t = text.trim();
  if (!/^\d{1,6}$/.test(t))
    throw new ToolInputError(`Enter a number of rows from 1 to ${MAX_ROWS.toLocaleString('en')}.`);
  const n = Number(t);
  if (n < 1 || n > MAX_ROWS)
    throw new ToolInputError(`The number of rows must be from 1 to ${MAX_ROWS.toLocaleString('en')}.`);
  return n;
}

/** Parses a YYYY-MM-DD reference day into an ISO timestamp at midnight UTC. */
export function parseRefDate(text: string): string {
  const t = text.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const iso = `${t}T00:00:00.000Z`;
  if (!match || Number.isNaN(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== t)
    throw new ToolInputError('Enter the reference date as YYYY-MM-DD, for example 2026-01-31.');
  return iso;
}

/** FNV-1a over UTF-8; a plain unsigned 32-bit integer is used as is. */
export function parseSeed(text: string): number | undefined {
  const t = text.trim();
  if (t === '') return undefined;
  if (/^\d{1,10}$/.test(t) && Number(t) <= 0xffff_ffff) return Number(t);
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(t.slice(0, 1000))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function parseNumber(raw: string | undefined, fallback: string, label: string, field: string): number {
  const t = (raw ?? '').trim() || fallback;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t))
    throw new ToolInputError(`${field}: “${label}” must be a number.`);
  return Number(t);
}

interface PreparedField {
  name: string;
  type: NonNullable<ReturnType<typeof findFieldType>>;
  params: Record<string, number>;
  empty: number;
}

function prepare(fields: readonly FieldSpec[]): PreparedField[] {
  if (fields.length === 0) throw new ToolInputError('Add at least one field.');
  if (fields.length > MAX_FIELDS) throw new ToolInputError(`Use at most ${MAX_FIELDS} fields.`);
  const seen = new Set<string>();
  return fields.map((spec, i) => {
    const name = spec.name.trim();
    const label = name || `Field ${i + 1}`;
    if (name === '') throw new ToolInputError(`Field ${i + 1} needs a name.`);
    if (name.length > MAX_NAME)
      throw new ToolInputError(`${label.slice(0, 20)}…: names are limited to ${MAX_NAME} characters.`);
    if ([...name].some((ch) => ch < ' ' || ch === '\u007f'))
      throw new ToolInputError(`Field ${i + 1}: the name can’t contain control characters.`);
    if (seen.has(name)) throw new ToolInputError(`Two fields are called “${name}”. Names must be unique.`);
    seen.add(name);
    const type = findFieldType(spec.type);
    if (!type) throw new ToolInputError(`${label}: unknown field type “${spec.type.slice(0, 40)}”.`);
    const params: Record<string, number> = {};
    for (const def of type.params ?? []) {
      const value = parseNumber(spec.params?.[def.key], def.default, def.label, label);
      if (def.integer && !Number.isInteger(value))
        throw new ToolInputError(`${label}: “${def.label}” must be a whole number.`);
      if (value < def.min || value > def.max)
        throw new ToolInputError(
          `${label}: “${def.label}” must be from ${def.min.toLocaleString('en')} to ${def.max.toLocaleString('en')}.`,
        );
      params[def.key] = value;
    }
    if ('min' in params && 'max' in params && params['min']! > params['max']!)
      throw new ToolInputError(`${label}: the minimum is larger than the maximum.`);
    const empty = parseNumber(spec.empty, '0', 'Empty %', label);
    if (empty < 0 || empty > 100) throw new ToolInputError(`${label}: “Empty %” must be from 0 to 100.`);
    return { name, type, params, empty: empty / 100 };
  });
}

/**
 * Generates `count` rows. Seeds `faker` and sets its reference date first, so
 * the same seed, reference date and fields always give the same rows.
 */
export function generateRows(
  faker: Faker,
  fields: readonly FieldSpec[],
  count: number,
  seed: number,
  refDate: string,
): Table {
  const prepared = prepare(fields);
  if (!Number.isInteger(count) || count < 1 || count > MAX_ROWS)
    throw new ToolInputError(`The number of rows must be from 1 to ${MAX_ROWS.toLocaleString('en')}.`);
  if (Number.isNaN(Date.parse(refDate))) throw new ToolInputError('The reference date is not a valid date.');
  faker.seed(seed >>> 0);
  faker.setDefaultRefDate(refDate);
  const rows: Value[][] = [];
  for (let r = 0; r < count; r++) {
    const row: Value[] = [];
    for (const f of prepared) {
      if (f.empty > 0 && faker.datatype.boolean({ probability: f.empty })) row.push(null);
      else if (f.type.id === 'sequence') row.push((f.params['start'] ?? 1) + r);
      else row.push(f.type.generate(faker, f.params));
    }
    rows.push(row);
  }
  return { columns: prepared.map((f) => f.name), rows };
}

function objects(table: Table): Array<Record<string, Value>> {
  // fromEntries defines own properties, so a column called "__proto__" stays data.
  return table.rows.map((row) => Object.fromEntries(table.columns.map((c, i) => [c, row[i] ?? null])));
}

export function toJson(table: Table): string {
  return JSON.stringify(objects(table), null, 2);
}

export function toNdjson(table: Table): string {
  return objects(table)
    .map((o) => JSON.stringify(o))
    .join('\n');
}

export function toCsv(table: Table): string {
  const cell = (v: Value) => (v === null ? '' : String(v));
  return writeCsv([table.columns, ...table.rows.map((r) => r.map(cell))]);
}

export function quoteIdentifier(name: string, style: QuoteStyle): string {
  if (style === 'mysql') return `\`${name.replace(/`/g, '``')}\``;
  if (style === 'mssql') return `[${name.replace(/]/g, ']]')}]`;
  return `"${name.replace(/"/g, '""')}"`;
}

export function sqlLiteral(value: Value, style: QuoteStyle): string {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return style === 'mssql' ? (value ? '1' : '0') : value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  // MySQL treats backslash as an escape character in strings by default.
  const body = (style === 'mysql' ? value.replace(/\\/g, '\\\\') : value).replace(/'/g, "''");
  // SQL Server needs the N prefix to keep characters outside the code page.
  return style === 'mssql' && [...value].some((ch) => ch > '\u007f') ? `N'${body}'` : `'${body}'`;
}

/** Table name, optionally schema-qualified with dots; each part is quoted. */
export function sqlTableName(table: string, style: QuoteStyle): string {
  const t = table.trim();
  if (t === '') throw new ToolInputError('Enter a table name for the SQL output.');
  if (t.length > 128) throw new ToolInputError('The table name is limited to 128 characters.');
  if ([...t].some((ch) => ch < ' ' || ch === '\u007f'))
    throw new ToolInputError('The table name can’t contain control characters.');
  const parts = t.split('.');
  if (parts.some((part) => part.trim() === ''))
    throw new ToolInputError('The table name has an empty part between dots.');
  return parts.map((part) => quoteIdentifier(part.trim(), style)).join('.');
}

export function toSql(table: Table, options: SqlOptions): string {
  const name = sqlTableName(options.table, options.quote);
  const columns = table.columns.map((c) => quoteIdentifier(c, options.quote)).join(', ');
  const batch = Math.max(1, Math.min(1000, Math.floor(options.batch) || 1));
  const values = table.rows.map((row) => `(${row.map((v) => sqlLiteral(v, options.quote)).join(', ')})`);
  const statements: string[] = [];
  for (let i = 0; i < values.length; i += batch) {
    const chunk = values.slice(i, i + batch);
    statements.push(
      chunk.length === 1
        ? `INSERT INTO ${name} (${columns}) VALUES ${chunk[0]};`
        : `INSERT INTO ${name} (${columns}) VALUES\n  ${chunk.join(',\n  ')};`,
    );
  }
  return statements.join('\n');
}

export function formatTable(table: Table, format: Format, sql: SqlOptions): string {
  switch (format) {
    case 'json':
      return toJson(table);
    case 'ndjson':
      return toNdjson(table);
    case 'csv':
      return toCsv(table);
    case 'sql':
      return toSql(table, sql);
  }
}

export const FORMAT_FILES: Record<Format, { ext: string; mime: string }> = {
  json: { ext: 'json', mime: 'application/json' },
  ndjson: { ext: 'ndjson', mime: 'application/x-ndjson' },
  csv: { ext: 'csv', mime: 'text/csv;charset=utf-8' },
  sql: { ext: 'sql', mime: 'application/sql' },
};

/** The whole pipeline: validate, generate, format. Runs in the worker. */
export function mockData(faker: Faker, request: MockRequest): string {
  const count = parseCount(request.count);
  // Validate the table name before spending time on generation.
  if (request.format === 'sql') sqlTableName(request.sql.table, request.sql.quote);
  const refDate = parseRefDate(request.refDate);
  const table = generateRows(faker, request.fields, count, request.seed, refDate);
  const text = formatTable(table, request.format, request.sql);
  if (text.length > MAX_OUTPUT)
    throw new ToolInputError(
      `The output would be about ${Math.round(text.length / 1e6)} MB. Use fewer rows or shorter fields.`,
    );
  return text;
}
