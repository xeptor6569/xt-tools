import { useEffect, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { loadLocalAsset } from '../../lib/load-local-asset.ts';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import { DATA_FILE } from './dataset.ts';
import type * as LogicModule from './logic.ts';
import type { K8sSchemas } from './logic.ts';
import meta from './meta.ts';
import { TEMPLATES } from './templates.ts';

type Logic = typeof LogicModule;

interface Loaded {
  logic: Logic;
  data: K8sSchemas;
}

const COLUMNS = [
  { key: 'document', label: 'Doc' },
  { key: 'line', label: 'Line' },
  { key: 'severity', label: 'Level' },
  { key: 'path', label: 'Path', mono: true },
  { key: 'message', label: 'Message' },
] as const;

async function load(): Promise<Loaded> {
  const [logic, data] = await Promise.all([
    import('./logic.ts'),
    loadLocalAsset(DATA_FILE).then((r) => r.json() as Promise<K8sSchemas>),
  ]);
  return { logic, data };
}

export default function K8sManifestTool() {
  const [input, setInput] = useState('');
  const [bestPractices, setBestPractices] = useState(true);
  const [loaded, setLoaded] = useState<Loaded>();
  const [loadError, setLoadError] = useState<string>();
  const text = useDebounced(input, 250);

  useEffect(() => {
    load().then(setLoaded, (e: unknown) => setLoadError(errorMessage(e)));
  }, []);

  const result = useMemo(
    () =>
      runTool(() => {
        if (!loaded) return undefined;
        const report = loaded.logic.validateManifests(text, loaded.data, { bestPractices });
        return { report, summary: loaded.logic.summarize(report) };
      }),
    [loaded, text, bestPractices],
  );
  const report = result.output?.report;
  const rows = (report?.issues ?? []).map((i) => ({
    ...i,
    severity: i.severity === 'error' ? 'Error' : 'Warning',
    path: i.path || '(document)',
  }));
  const tone = !report
    ? 'text-fg'
    : report.invalid > 0
      ? 'text-danger'
      : report.valid > 0
        ? 'text-success'
        : 'text-muted';

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Starter templates">
        <span class="text-sm text-muted">Start from:</span>
        {TEMPLATES.map((t) => (
          <Button
            key={t.id}
            class="min-h-7 px-2 py-0.5 text-xs"
            onClick={() => setInput(t.yaml)}
            aria-label={`Load ${t.label} template`}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <TextArea
        label="Manifest (YAML)"
        value={input}
        onValue={setInput}
        rows={18}
        placeholder={'apiVersion: v1\nkind: ConfigMap\n…\n---\n(separate documents with ---)'}
        hint="Multiple documents separated by --- are validated one by one. Nothing leaves your browser."
        data-xt="input"
      />
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Toggle
          label="Best-practice warnings"
          checked={bestPractices}
          onChecked={setBestPractices}
          hint="Image tags, resources, probes, privileged, runAsNonRoot and hostNetwork."
        />
        <ExampleButton examples={meta.examples} onPick={setInput} />
      </div>
      <OutputRegion label="Validation result" busy={!loaded && !loadError}>
        {!loaded && !loadError && <LoadingState label="Loading Kubernetes schemas…" />}
        {result.output && <p class={`text-sm font-medium ${tone}`}>{result.output.summary}</p>}
        {report && report.documents.length > 0 && (
          <ul class="flex flex-col gap-1 text-sm" aria-label="Documents">
            {report.documents.map((d) => (
              <li key={d.document} class="flex flex-wrap gap-x-2">
                <span class="text-muted">
                  #{d.document} (line {d.line})
                </span>
                <span class="font-mono break-all">
                  {[d.apiVersion, d.kind, d.name && `“${d.name}”`].filter(Boolean).join(' ') || 'unknown'}
                </span>
                <span
                  class={
                    d.status === 'valid' ? 'text-success' : d.status === 'invalid' ? 'text-danger' : 'text-warning'
                  }
                >
                  {d.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && <ResultTable caption="Errors and warnings" columns={COLUMNS} rows={rows} />}
        <ErrorMessage message={loadError ?? result.error} />
      </OutputRegion>
      {loaded && (
        <p class="text-xs text-muted">
          Schemas generated from the Kubernetes {loaded.data.version} OpenAPI spec (Apache-2.0), covering{' '}
          {loaded.data.kinds.length} built-in kinds. Custom resources are skipped.
        </p>
      )}
    </div>
  );
}
