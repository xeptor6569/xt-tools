import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import type { SqliteOutputFormat, SqliteRunResult } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const FORMATS: ReadonlyArray<{ value: SqliteOutputFormat; label: string }> = [
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'tsv', label: 'TSV' },
];

const SAMPLE_SQL = `SELECT p.name, p.category, p.price, COALESCE(SUM(o.quantity), 0) AS sold
FROM products p
LEFT JOIN orders o ON o.product_id = p.id
GROUP BY p.id
ORDER BY sold DESC;`;

export default function SqliteBrowserTool() {
  const call = useWorker(createWorker, { timeoutMs: 30_000 });
  const [input, setInput] = useState(
    "CREATE TABLE items (name TEXT, qty INT);\nINSERT INTO items VALUES ('apple', 3), ('pear', 5);\nSELECT name, qty FROM items ORDER BY qty DESC;",
  );
  const [format, setFormat] = useState<SqliteOutputFormat>('json');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [result, setResult] = useState<SqliteRunResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const debouncedSql = useDebounced(input, 150);

  useEffect(() => {
    let current = true;
    if (!file && debouncedSql.trim() === '') {
      setResult(undefined);
      setError(undefined);
      setBusy(false);
      return;
    }
    setBusy(true);
    call<SqliteRunResult>('runSqlite', debouncedSql, {
      dbBytes: file?.bytes,
      format,
      exportDb: true,
    })
      .then(
        (res) => {
          if (!current) return;
          setResult(res);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setResult(undefined);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [debouncedSql, file, format, call]);

  const handleLoadSampleDb = () => {
    setBusy(true);
    call<Uint8Array>('createSampleSqliteDb')
      .then(
        (bytes) => {
          setFile({ name: 'store.sqlite', bytes });
          setInput(SAMPLE_SQL);
        },
        (e: unknown) => setError(errorMessage(e)),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div class="flex flex-col gap-4">
      <FileDropZone
        label="SQLite database file (.sqlite, .db, .sqlite3)"
        accept=".sqlite,.db,.sqlite3,application/vnd.sqlite3,application/x-sqlite3"
        maxBytes={64 * 1024 * 1024}
        onFiles={(picked) => {
          const f = picked[0];
          if (!f) return;
          void f.arrayBuffer().then((buf) => setFile({ name: f.name, bytes: new Uint8Array(buf) }));
        }}
        hint="Up to 64 MB. Drop a database file or run CREATE/INSERT/SELECT statements on an in-memory SQLite database."
      />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="secondary" onClick={handleLoadSampleDb} disabled={busy}>
          Load sample store.sqlite database
        </Button>
        {file && (
          <>
            <span>
              Database: <span class="font-medium">{file.name}</span> ({file.bytes.length.toLocaleString('en')} bytes)
            </span>
            <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
              Close file (use in-memory DB)
            </button>
          </>
        )}
      </div>
      {result && result.tables.length > 0 && (
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="text-muted">Tables:</span>
          {result.tables.map((t) => (
            <button
              key={t.name}
              type="button"
              class="rounded border border-border bg-surface px-2 py-1 font-mono hover:border-accent"
              onClick={() => setInput(`SELECT * FROM "${t.name.replace(/"/g, '""')}" LIMIT 100;`)}
            >
              {t.name} ({t.rowCount})
            </button>
          ))}
        </div>
      )}
      <TwoPane
        inputLabel="SQL query"
        inputPlaceholder="SELECT * FROM sqlite_master;"
        input={input}
        onInput={setInput}
        outputLabel="Query output"
        output={result?.text ?? ''}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={<Select label="Output format" value={format} options={FORMATS} onValue={setFormat} />}
        actions={
          result?.dbBytes ? (
            <DownloadButton
              data={result.dbBytes}
              filename={file?.name ?? 'database.sqlite'}
              mime="application/vnd.sqlite3"
              label="Download .sqlite"
            />
          ) : undefined
        }
      />
      {result && result.columns.length > 0 && result.rows.length > 0 && (
        <ResultTable
          caption={`Result rows (${result.rows.length})`}
          columns={result.columns.map((c) => ({ key: c, label: c, mono: true }))}
          rows={result.rows.slice(0, 200).map((row) => {
            const out: Record<string, string> = {};
            for (const c of result.columns) {
              const v = row[c];
              out[c] = v === null || v === undefined ? 'NULL' : String(v);
            }
            return out;
          })}
        />
      )}
    </div>
  );
}
