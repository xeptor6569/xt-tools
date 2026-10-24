import type { SqlFormatFn } from './logic.ts';

/** Loads sql-formatter (about 80 KB gzipped) as a separate chunk, only on this page. */
export async function loadSqlFormatter(): Promise<SqlFormatFn> {
  const { format } = await import('sql-formatter');
  return format;
}
