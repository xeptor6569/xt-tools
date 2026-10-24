import { useEffect, useMemo, useState } from 'preact/hooks';
import { buttonClass } from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import Input from '../../components/ui/Input.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { DEFAULT_MAX_RESULTS, MAX_RESULT_OPTIONS } from './limits.ts';
import type { QueryResult } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const STORE = JSON.stringify(
  {
    store: {
      book: [
        { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
        { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
        { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
        {
          category: 'fiction',
          author: 'J. R. R. Tolkien',
          title: 'The Lord of the Rings',
          isbn: '0-395-19395-8',
          price: 22.99,
        },
      ],
      bicycle: { color: 'red', price: 19.95 },
    },
  },
  null,
  2,
);

const SAMPLE_QUERIES = [
  { path: '$..author', label: 'All authors' },
  { path: '$.store.book[?(@.price < 10)]', label: 'Books under 10' },
  { path: '$..book[-1:]', label: 'Last book' },
  { path: '$..book[?(@.isbn)].title', label: 'Titles with an ISBN' },
  { path: '$.store..price', label: 'All prices' },
  { path: '$..*', label: 'Everything' },
];

/** Rows rendered in the paths table; the JSON output holds every collected match. */
const TABLE_ROWS = 500;

const MAX_OPTIONS = MAX_RESULT_OPTIONS.map((n) => ({ value: String(n), label: n.toLocaleString('en') }));

export default function JsonQueryTool() {
  const call = useWorker(createWorker);
  const [input, setInput] = useState(STORE);
  const [query, setQuery] = useState('$..*');
  const [max, setMax] = useState(String(DEFAULT_MAX_RESULTS));
  const [result, setResult] = useState<QueryResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const args = useDebounced(
    useMemo(() => ({ input, query, max: Number(max) }), [input, query, max]),
    150,
  );

  useEffect(() => {
    let current = true;
    setBusy(true);
    call<QueryResult>('jsonQuery', args.input, args.query, args.max)
      .then(
        (value) => {
          if (!current) return;
          setResult(value);
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
  }, [args, call]);

  const count = result?.matches.length ?? 0;
  const empty = args.input.trim() === '';

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-end gap-4">
          <div class="min-w-64 flex-1">
            <Input
              label="JSONPath expression"
              value={query}
              onValue={setQuery}
              placeholder="$.store.book[*].author"
              class="w-full font-mono"
              hint="Filters such as [?(@.price < 10)] run in a safe evaluator; no code is executed."
            />
          </div>
          <Select label="Max results" value={max} options={MAX_OPTIONS} onValue={setMax} />
        </div>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-muted">Sample queries:</span>
          {SAMPLE_QUERIES.map((q) => (
            <button
              key={q.path}
              type="button"
              class={`${buttonClass('secondary')} min-h-7 px-2 py-0.5 font-mono text-xs`}
              aria-label={`${q.label}: ${q.path}`}
              aria-pressed={query === q.path}
              onClick={() => setQuery(q.path)}
            >
              {q.path}
            </button>
          ))}
          <button
            type="button"
            class={`${buttonClass('secondary')} min-h-7 px-2 py-0.5 text-xs`}
            onClick={() => setInput(STORE)}
          >
            Load the bookstore sample
          </button>
        </div>
      </div>
      <TwoPane
        inputLabel="JSON document"
        input={input}
        onInput={setInput}
        inputPlaceholder='{"store": {"book": []}}'
        outputLabel="Matches (JSON array)"
        output={result?.text ?? ''}
        error={error}
        busy={busy}
        examples={meta.examples}
        actions={<DownloadButton data={result?.text ?? ''} filename="matches.json" mime="application/json" />}
      />
      {result && !empty && (
        <section aria-label="Matched paths" class="flex flex-col gap-2">
          <p class="text-sm text-muted" role="status" data-xt="match-count">
            {count === 0
              ? 'No matches.'
              : `${count}${result.truncated ? '+' : ''} match${count === 1 && !result.truncated ? '' : 'es'}${
                  result.truncated ? ` (showing the first ${count})` : ''
                }.`}
          </p>
          {count > 0 && (
            <ResultTable
              caption="Matched paths and values"
              columns={[
                { key: 'path', label: 'JSONPath', mono: true },
                { key: 'pointer', label: 'JSON Pointer', mono: true },
                { key: 'preview', label: 'Value', mono: true },
              ]}
              rows={result.matches
                .slice(0, TABLE_ROWS)
                .map((m) => ({ ...m, pointer: m.pointer === '' ? '(root)' : m.pointer }))}
            />
          )}
          {count > TABLE_ROWS && (
            <p class="text-xs text-muted">
              The table shows the first {TABLE_ROWS} matches; the JSON output has all {count}.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
