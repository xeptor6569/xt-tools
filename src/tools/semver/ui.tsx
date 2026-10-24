import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList, { type KeyValueItem } from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { analyzeRange, compareVersions, incrementVersion, sortVersions, type Order } from './logic.ts';
import meta from './meta.ts';

const ORDERS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const satisfies ReadonlyArray<{ value: Order; label: string }>;

const RELATION_WORDS = { '<': 'is lower than', '=': 'has the same precedence as', '>': 'is higher than' } as const;

const MAX_TABLE_ROWS = 500;

function describeDiff(type: string): string {
  if (type === 'prerelease') return 'only the prerelease part differs';
  if (type.startsWith('pre')) return `the ${type.slice(3)} number differs and one of them is a prerelease`;
  return `the ${type} number differs`;
}

export default function SemverTool() {
  const [input, setInput] = useState('1.10.0\n1.2.3\n1.2.10\nv2.0.0-beta.1\n2.1.0\n0.9.0');
  const [range, setRange] = useState('^1.2.0 || >=2.1.0 <3');
  const [order, setOrder] = useState<Order>('asc');
  const [includePrerelease, setIncludePrerelease] = useState(false);
  const [loose, setLoose] = useState(false);
  const [a, setA] = useState('1.2.3');
  const [b, setB] = useState('1.3.0-rc.1');
  const [base, setBase] = useState('1.2.3');
  const [preid, setPreid] = useState('beta');
  const debounced = useDebounced(input, 150);
  const options = useMemo(() => ({ loose, includePrerelease }), [loose, includePrerelease]);

  const sorted = useMemo(() => runTool(() => sortVersions(debounced, order, options)), [debounced, order, options]);
  const versions = sorted.output?.versions;
  const ranged = useMemo(() => runTool(() => analyzeRange(range, versions ?? [], options)), [range, versions, options]);
  const compared = useMemo(() => runTool(() => compareVersions(a, b, loose)), [a, b, loose]);
  const increments = useMemo(() => runTool(() => incrementVersion(base, preid, loose)), [base, preid, loose]);

  const invalid = sorted.output?.invalid ?? [];
  const r = ranged.output;
  const rangeItems: KeyValueItem[] = r
    ? [
        { label: 'Normalized range', value: r.normalized },
        ...(r.alternatives.length > 1
          ? [{ label: 'Alternatives', value: r.alternatives.join('  ||  '), note: 'A version must match one of them.' }]
          : []),
        {
          label: 'Lowest possible',
          value: r.minVersion ?? 'No version can satisfy this range',
          mono: r.minVersion !== null,
          note: 'The smallest version that could ever match.',
        },
        {
          label: 'Satisfying',
          value: `${r.matching.size} of ${versions?.length ?? 0} versions`,
          mono: false,
        },
        ...(r.maxSatisfying ? [{ label: 'Highest satisfying', value: r.maxSatisfying }] : []),
        ...(r.minSatisfying ? [{ label: 'Lowest satisfying', value: r.minSatisfying }] : []),
      ]
    : [];

  const rows = (versions ?? []).slice(0, MAX_TABLE_ROWS).map((v) => ({
    text: v.text,
    version: v.version,
    satisfies: r ? (r.matching.has(v.line) ? 'Yes' : 'No') : '–',
    kind: v.parsed.prerelease.length ? 'Prerelease' : 'Release',
  }));

  const c = compared.output;

  return (
    <div class="flex flex-col gap-6">
      <TwoPane
        controls={
          <>
            <div class="min-w-64 flex-1">
              <Input
                label="Range"
                value={range}
                onValue={setRange}
                placeholder="^1.2.0 || >=2.1.0 <3"
                hint="npm syntax: ^, ~, x ranges, hyphen ranges, comparators and ||."
                class="font-mono"
              />
            </div>
            <Select label="Order" value={order} options={ORDERS} onValue={setOrder} />
            <Toggle
              label="Include prereleases"
              checked={includePrerelease}
              onChecked={setIncludePrerelease}
              hint="Let ranges match any prerelease."
            />
            <Toggle label="Loose parsing" checked={loose} onChecked={setLoose} hint="Accept =1.2.3, 1.2.3beta…" />
          </>
        }
        inputLabel="Versions (one per line)"
        input={input}
        onInput={setInput}
        inputPlaceholder={'1.2.3\nv2.0.0-rc.1\n1.10.0'}
        outputLabel="Sorted versions"
        output={sorted.output?.text ?? ''}
        error={sorted.error}
        examples={meta.examples}
      />

      {invalid.length > 0 && (
        <p role="status" class="rounded-lg border border-warning bg-warning-bg p-3 text-sm text-fg">
          {invalid.length === 1 ? '1 line is' : `${invalid.length} lines are`} not a valid semantic version
          {loose ? '' : ' (try loose parsing)'}:{' '}
          <span class="font-mono break-all">
            {invalid
              .slice(0, 20)
              .map((i) => `line ${i.line}: ${i.text.slice(0, 60)}`)
              .join(', ')}
            {invalid.length > 20 ? ', …' : ''}
          </span>
        </p>
      )}

      <section class="flex flex-col gap-2" aria-label="Range">
        <h2 class="text-base font-semibold">Range</h2>
        <ErrorMessage message={ranged.error} />
        {r && <KeyValueList items={rangeItems} />}
        {rows.length > 0 && (
          <ResultTable
            caption="Versions and whether they satisfy the range"
            columns={[
              { key: 'text', label: 'Input', mono: true },
              { key: 'version', label: 'Version', mono: true },
              { key: 'kind', label: 'Kind' },
              { key: 'satisfies', label: 'Satisfies range' },
            ]}
            rows={rows}
          />
        )}
      </section>

      <section class="flex flex-col gap-3" aria-label="Compare two versions">
        <h2 class="text-base font-semibold">Compare two versions</h2>
        <div class="flex flex-wrap items-end gap-4">
          <Input label="Version A" value={a} onValue={setA} class="w-48 font-mono" />
          <Input label="Version B" value={b} onValue={setB} class="w-48 font-mono" />
        </div>
        <OutputRegion label="Comparison">
          {c && (
            <p class="text-sm">
              <span class="font-mono">{c.a}</span> {RELATION_WORDS[c.relation]} <span class="font-mono">{c.b}</span> (
              <span class="font-mono">{`${c.a} ${c.relation} ${c.b}`}</span>).{' '}
              {c.difference
                ? `Difference: ${c.difference} (${describeDiff(c.difference)}).`
                : c.buildDiffers
                  ? 'Only the build metadata differs, which semver ignores for precedence.'
                  : 'They are the same version.'}
            </p>
          )}
          <ErrorMessage message={compared.error} />
        </OutputRegion>
      </section>

      <section class="flex flex-col gap-3" aria-label="Increment a version">
        <h2 class="text-base font-semibold">Increment a version</h2>
        <div class="flex flex-wrap items-end gap-4">
          <Input label="Version" value={base} onValue={setBase} class="w-48 font-mono" />
          <Input
            label="Prerelease identifier"
            value={preid}
            onValue={setPreid}
            placeholder="alpha, beta, rc…"
            class="w-40 font-mono"
          />
        </div>
        <OutputRegion label="Next versions">
          {increments.output && <KeyValueList items={increments.output} />}
          <ErrorMessage message={increments.error} />
        </OutputRegion>
      </section>
      <p class="text-xs text-muted">Uses the semver package (ISC), the same version logic as npm.</p>
    </div>
  );
}
