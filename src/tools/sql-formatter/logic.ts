import type { FormatOptionsWithLanguage, SqlLanguage } from 'sql-formatter';
import { ToolInputError } from '../types.ts';

/** The `format` function from sql-formatter, injected so this module stays small and testable. */
export type SqlFormatFn = (query: string, options?: FormatOptionsWithLanguage) => string;

export type Dialect = Exclude<SqlLanguage, 'tsql'>;
export type LetterCase = 'preserve' | 'upper' | 'lower';
export type Indent = '2' | '4' | 'tab';
export type IndentStyle = 'standard' | 'tabularLeft' | 'tabularRight';

export const DIALECTS: ReadonlyArray<{ value: Dialect; label: string }> = [
  { value: 'sql', label: 'Standard SQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'transactsql', label: 'SQL Server (T-SQL)' },
  { value: 'plsql', label: 'Oracle (PL/SQL)' },
  { value: 'bigquery', label: 'Google BigQuery' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'redshift', label: 'Amazon Redshift' },
  { value: 'duckdb', label: 'DuckDB' },
  { value: 'clickhouse', label: 'ClickHouse' },
  { value: 'db2', label: 'IBM Db2' },
  { value: 'db2i', label: 'IBM Db2 for i' },
  { value: 'spark', label: 'Spark SQL' },
  { value: 'hive', label: 'Apache Hive' },
  { value: 'trino', label: 'Trino / Presto' },
  { value: 'tidb', label: 'TiDB' },
  { value: 'singlestoredb', label: 'SingleStore' },
  { value: 'n1ql', label: 'Couchbase N1QL' },
];

export interface SqlFormatOptions {
  dialect?: Dialect;
  keywordCase?: LetterCase;
  identifierCase?: LetterCase;
  dataTypeCase?: LetterCase;
  functionCase?: LetterCase;
  indent?: Indent;
  indentStyle?: IndentStyle;
  /** Put AND/OR at the start of the line (`before`) or at the end (`after`). */
  logicalOperatorNewline?: 'before' | 'after';
  linesBetweenQueries?: number;
  /** `a=1` instead of `a = 1`. */
  denseOperators?: boolean;
  newlineBeforeSemicolon?: boolean;
}

// sql-formatter handles about 400 KB per second; this keeps a run under a second.
const MAX_INPUT = 256 * 1024;
// Each level of parentheses adds a level of indentation, so the output grows quadratically.
const MAX_DEPTH = 200;

function maxParenDepth(input: string): number {
  let depth = 0;
  let max = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c === 40) max = Math.max(max, ++depth);
    else if (c === 41 && depth > 0) depth--;
  }
  return max;
}

/** Turns sql-formatter's parse errors into a short message with the position. */
function parseError(error: Error, dialect: Dialect): ToolInputError | undefined {
  const firstLine = error.message.split('\n')[0] ?? '';
  if (!firstLine.startsWith('Parse error')) return undefined;
  const pos = /at line (\d+) column (\d+)/.exec(firstLine);
  const at = pos ? ` at line ${pos[1]}, column ${pos[2]}` : '';
  let what = 'Unexpected input';
  const unexpected = /^Parse error: Unexpected "([\s\S]*)" at line/.exec(firstLine);
  const token = /^Parse error at token: ([\s\S]*?) at line/.exec(firstLine);
  if (unexpected) what = `Unexpected text «${unexpected[1] ?? ''}»`;
  else if (token) what = token[1] === '«EOF»' ? 'The query ends too early' : `Unexpected ${token[1] ?? ''}`;
  const hint = dialect === 'sql' ? ' Picking the dialect of your database may help.' : '';
  return new ToolInputError(`Can’t parse this SQL${at}: ${what}.${hint}`);
}

/** Formats SQL with sql-formatter. Strings, comments and identifiers are kept; only whitespace and case change. */
export function formatSql(input: string, options: SqlFormatOptions, format: SqlFormatFn): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 256 KB).');
  if (input.trim() === '') return '';
  if (maxParenDepth(input) > MAX_DEPTH) {
    throw new ToolInputError(`The SQL is nested too deeply to format (more than ${MAX_DEPTH} levels of parentheses).`);
  }

  const {
    dialect = 'sql',
    keywordCase = 'upper',
    identifierCase = 'preserve',
    dataTypeCase = 'preserve',
    functionCase = 'preserve',
    indent = '2',
    indentStyle = 'standard',
    logicalOperatorNewline = 'before',
    linesBetweenQueries = 1,
    denseOperators = false,
    newlineBeforeSemicolon = false,
  } = options;

  try {
    return format(input, {
      language: dialect,
      keywordCase,
      identifierCase,
      dataTypeCase,
      functionCase,
      tabWidth: indent === '4' ? 4 : 2,
      useTabs: indent === 'tab',
      indentStyle,
      logicalOperatorNewline,
      linesBetweenQueries: Math.max(0, Math.min(5, Math.trunc(linesBetweenQueries))),
      denseOperators,
      newlineBeforeSemicolon,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new ToolInputError('The SQL is too complex or nested too deeply to format.');
    }
    const mapped = error instanceof Error ? parseError(error, dialect) : undefined;
    if (mapped) throw mapped;
    throw error;
  }
}
