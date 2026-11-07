import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { ToolInputError } from '../types.ts';

const MAX_SQL = 500_000;
const MAX_DB_BYTES = 64 * 1024 * 1024;
const SQLITE_MAGIC = 'SQLite format 3\0';

export type SqliteOutputFormat = 'json' | 'csv' | 'tsv';

export interface SqliteTableSummary {
  name: string;
  type: string;
  rowCount: number;
  columns: string[];
}

export interface SqliteRunResult {
  text: string;
  tables: SqliteTableSummary[];
  rows: Array<Record<string, unknown>>;
  columns: string[];
  dbBytes?: Uint8Array;
}

let sqlPromise: Promise<SqlJsStatic> | undefined;

export async function getSqlJs(wasmUrl?: string): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
  }
  return await sqlPromise;
}

function validateDatabaseHeader(bytes: Uint8Array): void {
  if (bytes.length === 0) return;
  if (bytes.length < 16) throw new ToolInputError('That file is too small to be a SQLite 3 database.');
  const magic = new TextDecoder('latin1').decode(bytes.subarray(0, 16));
  if (magic !== SQLITE_MAGIC) {
    throw new ToolInputError('That file does not have a valid "SQLite format 3" header.');
  }
}

function csvCell(val: unknown, sep: string): string {
  if (val === null || val === undefined) return '';
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(sep)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatResultRows(
  columns: string[],
  values: unknown[][],
  format: SqliteOutputFormat,
): { text: string; objects: Array<Record<string, unknown>> } {
  const objects = values.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i] ?? `col_${i + 1}`;
      const val = row[i];
      obj[col] = val instanceof Uint8Array ? `0x${[...val].map((b) => b.toString(16).padStart(2, '0')).join('')}` : val;
    }
    return obj;
  });

  if (format === 'csv' || format === 'tsv') {
    const sep = format === 'tsv' ? '\t' : ',';
    const header = columns.map((c) => csvCell(c, sep)).join(sep);
    const body = values.map((row) => row.map((v) => csvCell(v, sep)).join(sep));
    return { text: [header, ...body].join('\n'), objects };
  }

  return { text: JSON.stringify(objects, null, 2), objects };
}

/**
 * Executes a SQL script against an optional SQLite database byte array and returns
 * the formatted result set, schema summary, and optional exported database bytes.
 */
export async function runSqlite(
  sql: string,
  options: {
    dbBytes?: Uint8Array;
    format?: SqliteOutputFormat;
    exportDb?: boolean;
    wasmUrl?: string;
  } = {},
): Promise<SqliteRunResult> {
  if (sql.length > MAX_SQL) throw new ToolInputError('SQL query is too large (maximum 500 KB).');
  if (options.dbBytes && options.dbBytes.length > MAX_DB_BYTES) {
    throw new ToolInputError('Database file exceeds the 64 MB limit.');
  }
  if (!options.dbBytes && sql.trim() === '') {
    return { text: '', tables: [], rows: [], columns: [] };
  }
  if (options.dbBytes) validateDatabaseHeader(options.dbBytes);

  const SQL = await getSqlJs(options.wasmUrl);
  const db = options.dbBytes ? new SQL.Database(options.dbBytes) : new SQL.Database();
  const format: SqliteOutputFormat = options.format ?? 'json';

  try {
    let results: Array<{ columns: string[]; values: unknown[][] }> = [];
    if (sql.trim() !== '') {
      try {
        results = db.exec(sql);
      } catch (error) {
        throw new ToolInputError(error instanceof Error ? `SQL error: ${error.message}` : 'Invalid SQL statement.');
      }
    }

    const schemaRes = db.exec(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const tables: SqliteTableSummary[] = [];
    for (const row of schemaRes[0]?.values ?? []) {
      const name = String(row[0] ?? '');
      const type = String(row[1] ?? 'table');
      const quoted = `"${name.replace(/"/g, '""')}"`;
      let rowCount = 0;
      let cols: string[] = [];
      try {
        const countRes = db.exec(`SELECT COUNT(*) FROM ${quoted}`);
        rowCount = Number(countRes[0]?.values[0]?.[0] ?? 0);
        const infoRes = db.exec(`PRAGMA table_info(${quoted})`);
        cols = (infoRes[0]?.values ?? []).map((c) => `${String(c[1])}:${String(c[2] || 'ANY')}`);
      } catch {
        // View or virtual table that failed count.
      }
      tables.push({ name, type, rowCount, columns: cols });
    }

    const last = results[results.length - 1];
    let text = '';
    let rows: Array<Record<string, unknown>> = [];
    let columns: string[] = [];

    if (last) {
      columns = last.columns;
      const formatted = formatResultRows(last.columns, last.values, format);
      text = formatted.text;
      rows = formatted.objects;
    } else if (tables.length > 0) {
      text = tables
        .map((t) => `${t.type} ${t.name} (${t.rowCount} row${t.rowCount === 1 ? '' : 's'}): ${t.columns.join(', ')}`)
        .join('\n');
    } else {
      text = 'Query executed (0 rows returned).';
    }

    const dbBytes = options.exportDb ? db.export() : undefined;
    return {
      text,
      tables,
      rows,
      columns,
      ...(dbBytes ? { dbBytes } : {}),
    };
  } finally {
    db.close();
  }
}

export async function sqliteBrowser(input: string): Promise<string> {
  return (await runSqlite(input)).text;
}

/**
 * Builds a sample SQLite 3 database file with products and orders for browsing.
 */
export async function createSampleSqliteDb(wasmUrl?: string): Promise<Uint8Array> {
  const res = await runSqlite(
    `
    CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL);
    INSERT INTO products (name, category, price) VALUES
      ('Mechanical Keyboard', 'hardware', 129.00),
      ('USB-C Hub', 'accessories', 45.50),
      ('27-inch Monitor', 'hardware', 319.99),
      ('Desk Lamp', 'office', 34.00);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES products(id), quantity INTEGER NOT NULL);
    INSERT INTO orders (product_id, quantity) VALUES (1, 2), (2, 5), (3, 1), (1, 1);
    `,
    { exportDb: true, ...(wasmUrl ? { wasmUrl } : {}) },
  );
  return res.dbBytes ?? new Uint8Array();
}
