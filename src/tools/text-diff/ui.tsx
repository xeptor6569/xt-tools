import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { textDiff, type Mode } from './logic.ts';

const MODES = [
  { value: 'lines', label: 'Lines' },
  { value: 'words', label: 'Words' },
  { value: 'chars', label: 'Characters' },
] as const satisfies ReadonlyArray<{ value: Mode; label: string }>;

const LABEL = { same: 'unchanged', added: 'added', removed: 'removed' } as const;
const CLASS = {
  same: '',
  added: 'bg-success/15 text-success underline decoration-2',
  removed: 'bg-danger/15 text-danger line-through decoration-2',
} as const;

export default function TextDiffTool() {
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [mode, setMode] = useState<Mode>('lines');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const a = useDebounced(before, 200);
  const b = useDebounced(after, 200);
  const result = useMemo(
    () => runTool(() => textDiff(a, b, { mode, ignoreCase, ignoreWhitespace })),
    [a, b, mode, ignoreCase, ignoreWhitespace],
  );
  const r = result.output;
  const unit = mode === 'lines' ? 'line' : mode === 'words' ? 'word' : 'character';

  return (
    <div class="flex flex-col gap-4">
      <div class="grid gap-4 md:grid-cols-2">
        <TextArea label="Original" value={before} onValue={setBefore} data-xt="input" />
        <TextArea label="Changed" value={after} onValue={setAfter} />
      </div>
      <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Select label="Compare by" value={mode} options={MODES} onValue={setMode} />
        <Toggle label="Ignore case" checked={ignoreCase} onChecked={setIgnoreCase} />
        {mode === 'lines' && (
          <Toggle label="Ignore whitespace" checked={ignoreWhitespace} onChecked={setIgnoreWhitespace} />
        )}
      </div>
      <OutputRegion label="Differences">
        {r && (a !== '' || b !== '') && (
          <>
            <p class="text-sm text-muted" data-xt="summary">
              {r.identical ? 'No differences.' : `${r.removed} ${unit}(s) removed, ${r.added} ${unit}(s) added.`}
            </p>
            {!r.identical && (
              <pre class="overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-sm break-words whitespace-pre-wrap">
                {r.parts.map((p, i) =>
                  p.kind === 'same' ? (
                    <span key={i}>{p.text}</span>
                  ) : (
                    <span key={i} class={CLASS[p.kind]}>
                      <span class="sr-only">[{LABEL[p.kind]}: </span>
                      {p.text}
                      <span class="sr-only">]</span>
                    </span>
                  ),
                )}
              </pre>
            )}
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
