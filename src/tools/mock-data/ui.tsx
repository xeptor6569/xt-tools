import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { FIELD_TYPES, findFieldType, type FieldTypeId } from './fields.ts';
import {
  FORMAT_FILES,
  MAX_FIELDS,
  MAX_NAME,
  MAX_ROWS,
  parseSeed,
  type FieldSpec,
  type Format,
  type MockRequest,
  type QuoteStyle,
} from './logic.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const TIMEOUT_MS = 20_000;

const FORMATS = [
  { value: 'json', label: 'JSON (array)' },
  { value: 'ndjson', label: 'NDJSON (one object per line)' },
  { value: 'csv', label: 'CSV' },
  { value: 'sql', label: 'SQL INSERT statements' },
] as const satisfies ReadonlyArray<{ value: Format; label: string }>;

const QUOTES = [
  { value: 'ansi', label: 'Standard "name" (PostgreSQL, SQLite)' },
  { value: 'mysql', label: 'MySQL `name`' },
  { value: 'mssql', label: 'SQL Server [name]' },
] as const satisfies ReadonlyArray<{ value: QuoteStyle; label: string }>;

const TYPE_OPTIONS = FIELD_TYPES.map((t) => ({ value: t.id, label: t.label }));

interface FieldRow {
  key: number;
  name: string;
  type: FieldTypeId;
  params: Record<string, string>;
  empty: string;
}

const DEFAULTS: Array<[string, FieldTypeId]> = [
  ['id', 'uuid'],
  ['firstName', 'firstName'],
  ['lastName', 'lastName'],
  ['email', 'email'],
  ['city', 'city'],
  ['country', 'country'],
  ['createdAt', 'datePast'],
];

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function size(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function MockDataTool() {
  const call = useWorker(createWorker, { timeoutMs: TIMEOUT_MS });
  const nextKey = useRef(DEFAULTS.length);
  const [count, setCount] = useState('100');
  const [fields, setFields] = useState<FieldRow[]>(() =>
    DEFAULTS.map(([name, type], key) => ({ key, name, type, params: {}, empty: '' })),
  );
  const [seedText, setSeedText] = useState('');
  const [random, setRandom] = useState<number>();
  const [refDate, setRefDate] = useState('');
  const [format, setFormat] = useState<Format>('json');
  const [table, setTable] = useState('users');
  const [quote, setQuote] = useState<QuoteStyle>('ansi');
  const [multiRow, setMultiRow] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);

  // Randomness and "today" only exist in the browser, so set them after hydration.
  useEffect(() => {
    setRandom(randomSeed());
    setRefDate(today());
  }, []);

  const seed = parseSeed(seedText) ?? random;
  const request = useMemo<MockRequest | undefined>(
    () =>
      seed === undefined || refDate === ''
        ? undefined
        : {
            fields: fields.map((f): FieldSpec => ({ name: f.name, type: f.type, params: f.params, empty: f.empty })),
            count,
            seed,
            refDate,
            format,
            sql: { table, quote, batch: multiRow ? 100 : 1 },
          },
    [fields, count, seed, refDate, format, table, quote, multiRow],
  );
  const args = useDebounced(request, 250);

  useEffect(() => {
    if (!args) return;
    let current = true;
    setBusy(true);
    call<string>('generate', args)
      .then(
        (text) => {
          if (!current) return;
          setOutput(text);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
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

  const update = (key: number, patch: Partial<FieldRow>) =>
    setFields((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const remove = (key: number) => setFields((list) => list.filter((f) => f.key !== key));
  const add = () =>
    setFields((list) => {
      const key = nextKey.current++;
      let n = list.length + 1;
      while (list.some((f) => f.name === `field${n}`)) n++;
      return [...list, { key, name: `field${n}`, type: 'word', params: {}, empty: '' }];
    });

  const file = FORMAT_FILES[format];
  const seeded = seedText.trim() !== '';
  const rowsShown = output && !error ? count.trim() : '';
  const outputSize = useMemo(() => size(output), [output]);

  return (
    <div class="flex flex-col gap-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Rows"
          value={count}
          onValue={setCount}
          inputMode="numeric"
          hint={`1 to ${MAX_ROWS.toLocaleString('en')}`}
          data-xt="input"
        />
        <Select label="Format" value={format} options={FORMATS} onValue={setFormat} />
        <Input
          label="Seed"
          value={seedText}
          onValue={setSeedText}
          maxLength={1000}
          placeholder="Random"
          hint="Same seed and date, same data."
        />
        <Input
          label="Dates relative to"
          value={refDate}
          onValue={setRefDate}
          placeholder="YYYY-MM-DD"
          maxLength={10}
          hint="Past and future dates are counted from this day."
        />
      </div>

      {format === 'sql' && (
        <div class="flex flex-wrap items-end gap-4">
          <Input label="Table name" value={table} onValue={setTable} maxLength={128} />
          <Select label="Identifier quotes" value={quote} options={QUOTES} onValue={setQuote} />
          <Toggle label="Group 100 rows per INSERT" checked={multiRow} onChecked={setMultiRow} />
        </div>
      )}

      <section aria-labelledby="mock-fields-heading" class="flex flex-col gap-3">
        <h2 id="mock-fields-heading" class="text-base font-semibold">
          Fields
        </h2>
        {fields.map((f, i) => {
          const type = findFieldType(f.type);
          return (
            <fieldset key={f.key} class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
              <legend class="sr-only">
                Field {i + 1}: {f.name || 'unnamed'}
              </legend>
              <div class="flex flex-wrap items-end gap-3">
                <div class="w-full sm:w-44">
                  <Input
                    label="Name"
                    value={f.name}
                    onValue={(name) => update(f.key, { name })}
                    maxLength={MAX_NAME}
                    class="w-full font-mono"
                  />
                </div>
                <div class="w-full sm:w-auto sm:min-w-64">
                  <Select
                    label="Type"
                    value={f.type}
                    options={TYPE_OPTIONS}
                    onValue={(t) => update(f.key, { type: t, params: {} })}
                  />
                </div>
                {type?.params?.map((p) => (
                  <div key={p.key} class="w-32">
                    <Input
                      label={p.label}
                      value={f.params[p.key] ?? p.default}
                      onValue={(v) => update(f.key, { params: { ...f.params, [p.key]: v } })}
                      inputMode={p.integer && p.min >= 0 ? 'numeric' : 'decimal'}
                      maxLength={24}
                      class="w-full"
                    />
                  </div>
                ))}
                <div class="w-24">
                  <Input
                    label="Empty %"
                    value={f.empty}
                    onValue={(empty) => update(f.key, { empty })}
                    inputMode="decimal"
                    placeholder="0"
                    maxLength={6}
                    class="w-full"
                  />
                </div>
                <Button
                  onClick={() => remove(f.key)}
                  disabled={fields.length === 1}
                  aria-label={`Remove field ${f.name || i + 1}`}
                >
                  Remove
                </Button>
              </div>
              {type?.note && <p class="text-xs text-muted">{type.note}</p>}
            </fieldset>
          );
        })}
        <div>
          <Button onClick={add} disabled={fields.length >= MAX_FIELDS}>
            Add field
          </Button>
        </div>
      </section>

      <div class="flex flex-col gap-2">
        {busy && !output && !error && <LoadingState label="Loading the data generator…" />}
        <TextArea
          label="Generated data"
          value={output}
          readOnly
          rows={14}
          class="min-h-64"
          data-xt="output"
          aria-busy={busy ? 'true' : undefined}
        />
        <div class="flex flex-wrap items-center gap-2">
          <CopyButton text={output} />
          <DownloadButton data={output} filename={`mock-data.${file.ext}`} mime={file.mime} />
          <Button onClick={() => setRandom(randomSeed())} disabled={seeded} aria-describedby="mock-regenerate-hint">
            Regenerate
          </Button>
          <p id="mock-regenerate-hint" class="text-xs text-muted">
            {seeded
              ? 'Clear the seed to draw new random data.'
              : random !== undefined && `Random seed ${random}: enter it as the seed to get this data again.`}
          </p>
        </div>
        <p role="status" class="text-sm text-muted">
          {busy ? 'Generating…' : rowsShown ? `${rowsShown} rows, ${outputSize}.` : ''}
        </p>
        <ErrorMessage message={error} />
      </div>
      <p class="text-xs text-muted">
        Fake data from Faker (MIT), English locale, generated in your browser. Values are random and may by chance match
        real people, companies or numbers.
      </p>
    </div>
  );
}
