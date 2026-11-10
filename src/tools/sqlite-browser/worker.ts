// Runs SQLite browser off the main thread with the local sql-wasm.wasm asset.
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { resolveLocalAsset } from '../../lib/load-local-asset.ts';
import { expose } from '../../lib/worker-rpc.ts';
import { createSampleSqliteDb, runSqlite, type SqliteOutputFormat } from './logic.ts';

const resolvedWasmUrl = () => resolveLocalAsset(sqlWasmUrl).href;

expose({
  sqliteBrowser: (input: string) => runSqlite(input, { wasmUrl: resolvedWasmUrl() }).then((r) => r.text),
  runSqlite: (sql: string, opts: { dbBytes?: Uint8Array; format?: SqliteOutputFormat; exportDb?: boolean } = {}) =>
    runSqlite(sql, { ...opts, wasmUrl: resolvedWasmUrl() }),
  createSampleSqliteDb: () => createSampleSqliteDb(resolvedWasmUrl()),
});
