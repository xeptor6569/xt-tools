import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { dockerfileLinter, MAX_FINDINGS, RULES, type Severity } from './logic.ts';
import meta from './meta.ts';

const LABEL: Record<Severity, string> = { error: 'Error', warning: 'Warning', info: 'Info' };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const RULE_ROWS = Object.entries(RULES).map(([id, r]) => ({
  id,
  severity: LABEL[r.severity],
  title: r.title,
  why: r.why,
}));

export default function DockerfileLinterTool() {
  const [input, setInput] = useState('');
  const [hideInfo, setHideInfo] = useState(false);
  const text = useDebounced(input, 200);
  const result = useMemo(() => runTool(() => dockerfileLinter(text)), [text]);
  const r = result.output;
  const rows = (r?.findings ?? [])
    .filter((f) => !hideInfo || f.severity !== 'info')
    .map((f) => ({ line: String(f.line), severity: LABEL[f.severity], rule: f.rule, message: f.message, why: f.why }));

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <TextArea
          label="Dockerfile"
          value={input}
          onValue={setInput}
          rows={14}
          placeholder={'FROM node:22-slim\nWORKDIR /app\n…'}
          data-xt="input"
        />
        <ExampleButton examples={meta.examples} onPick={setInput} />
      </div>
      <Toggle label="Hide info-level findings" checked={hideInfo} onChecked={setHideInfo} />
      <OutputRegion label="Lint results">
        {r && text.trim() !== '' && (
          <>
            <p class="text-sm" data-xt="summary">
              {r.findings.length === 0 ? (
                <span class="font-medium text-success">
                  No issues found in {plural(r.instructions, 'instruction')}.
                </span>
              ) : (
                <>
                  <span class={r.counts.error ? 'font-semibold text-danger' : ''}>
                    {plural(r.counts.error, 'error')}
                  </span>
                  {', '}
                  <span class={r.counts.warning ? 'font-semibold text-warning' : ''}>
                    {plural(r.counts.warning, 'warning')}
                  </span>
                  {', '}
                  {r.counts.info} info
                  {hideInfo && r.counts.info > 0 && <span class="text-muted"> (hidden)</span>}
                  <span class="text-muted"> in {plural(r.instructions, 'instruction')}.</span>
                </>
              )}
            </p>
            {r.truncated && (
              <p class="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
                Only the first {MAX_FINDINGS} findings are shown.
              </p>
            )}
            {r.findings.length > 0 && (
              <ResultTable
                caption="Findings"
                columns={[
                  { key: 'line', label: 'Line', mono: true },
                  { key: 'severity', label: 'Severity' },
                  { key: 'rule', label: 'Rule', mono: true },
                  { key: 'message', label: 'Finding' },
                  { key: 'why', label: 'Why it matters' },
                ]}
                rows={rows}
                empty="Only info-level findings, which are hidden."
              />
            )}
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
      <details class="rounded-lg border border-border p-3">
        <summary class="cursor-pointer text-sm font-medium">All rules ({RULE_ROWS.length})</summary>
        <div class="mt-3">
          <ResultTable
            caption="Rules"
            copy={false}
            columns={[
              { key: 'id', label: 'Rule', mono: true },
              { key: 'severity', label: 'Severity' },
              { key: 'title', label: 'Checks for' },
              { key: 'why', label: 'Why it matters' },
            ]}
            rows={RULE_ROWS}
          />
        </div>
      </details>
      <p class="text-xs text-muted">
        The rule set and its wording are this tool’s own. The Dockerfile is checked in your browser and never leaves it.
      </p>
    </div>
  );
}
