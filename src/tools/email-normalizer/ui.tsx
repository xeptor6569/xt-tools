import { useMemo, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { DEFAULT_OPTIONS, emailNormalizer, type EmailOptions, type EmailRow } from './logic.ts';
import meta from './meta.ts';

const MAX_ROWS = 500;

const tableRows = (rows: EmailRow[]) =>
  rows.slice(0, MAX_ROWS).map((r) => ({
    line: String(r.line),
    original: r.original,
    normalized: r.normalized,
    notes: r.notes.length ? r.notes.join('; ') : 'unchanged',
  }));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function EmailNormalizerTool() {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<EmailOptions>(DEFAULT_OPTIONS);
  const set = (key: keyof EmailOptions) => (value: boolean) => setOptions((o) => ({ ...o, [key]: value }));
  const debounced = useDebounced(input, 150);

  const result = useMemo(() => runTool(() => emailNormalizer(debounced, options)), [debounced, options]);
  const out = result.output;
  const text = out?.addresses.join('\n') ?? '';
  const valid = useMemo(() => tableRows(out?.rows.filter((r) => r.status !== 'invalid') ?? []), [out]);
  const invalid = useMemo(() => tableRows(out?.rows.filter((r) => r.status === 'invalid') ?? []), [out]);

  return (
    <div class="flex flex-col gap-4">
      <TwoPane
        controls={
          <div class="flex flex-wrap gap-x-6">
            <Toggle
              label="Lowercase the local part"
              checked={options.lowercaseLocal}
              onChecked={set('lowercaseLocal')}
            />
            <Toggle
              label="Apply provider rules"
              checked={options.providerRules}
              onChecked={set('providerRules')}
              hint="Gmail dots and tags, Outlook, Yahoo, iCloud, Proton, Fastmail."
            />
            <Toggle
              label="Strip +tags for all domains"
              checked={options.stripAllTags}
              onChecked={set('stripAllTags')}
            />
            <Toggle label="Remove duplicates" checked={options.dedupe} onChecked={set('dedupe')} />
          </div>
        }
        inputLabel="Email addresses"
        input={input}
        onInput={setInput}
        inputPlaceholder={'One per line, or separated by commas or semicolons'}
        outputLabel="Normalized addresses"
        output={text}
        error={result.error}
        examples={meta.examples}
        actions={<DownloadButton data={text} filename="emails.txt" />}
      />
      <p role="note" class="rounded-lg border border-warning bg-warning-bg p-3 text-sm text-fg">
        These rules are heuristics. Providers decide how their addresses work and can change it, and two addresses that
        normalize the same are not proven to reach the same inbox. Use the result to spot likely duplicates, not to
        rewrite the addresses people gave you. Validation is pragmatic, not a full RFC 5322 check.
      </p>
      {out && out.rows.length > 0 && (
        <p class="text-sm text-muted" role="status">
          {out.rows.length === 1 ? '1 entry' : `${out.rows.length} entries`}: {out.changed} changed,{' '}
          {plural(out.duplicates, 'duplicate')}, {out.invalid} invalid.
        </p>
      )}
      {invalid.length > 0 && (
        <section class="flex flex-col gap-2" aria-label="Invalid entries">
          <h2 class="text-base font-semibold">Invalid entries</h2>
          <ResultTable
            caption="Invalid entries"
            columns={[
              { key: 'line', label: 'Line' },
              { key: 'original', label: 'Entry', mono: true },
              { key: 'notes', label: 'Problem' },
            ]}
            rows={invalid}
          />
        </section>
      )}
      {valid.length > 0 && (
        <section class="flex flex-col gap-2" aria-label="Changes">
          <h2 class="text-base font-semibold">Changes</h2>
          <ResultTable
            caption="Original and normalized addresses"
            columns={[
              { key: 'line', label: 'Line' },
              { key: 'original', label: 'Original', mono: true },
              { key: 'normalized', label: 'Normalized', mono: true },
              { key: 'notes', label: 'Notes' },
            ]}
            rows={valid}
          />
        </section>
      )}
      {out && out.rows.length > MAX_ROWS && (
        <p class="text-xs text-muted">The tables show the first {MAX_ROWS} entries of each kind.</p>
      )}
    </div>
  );
}
