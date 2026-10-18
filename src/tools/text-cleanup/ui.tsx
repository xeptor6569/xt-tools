import { useMemo, useState } from 'preact/hooks';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { textCleanup, type CleanupOptions } from './logic.ts';
import meta from './meta.ts';

const BLANKS = [
  { value: 'collapse', label: 'Collapse to one' },
  { value: 'remove', label: 'Remove all' },
  { value: 'keep', label: 'Keep' },
] as const;

export default function TextCleanupTool() {
  const [input, setInput] = useState('');
  const [o, setO] = useState<CleanupOptions>({ trimLines: true, blankLines: 'collapse', collapseSpaces: true });
  const set = (patch: Partial<CleanupOptions>) => setO((prev) => ({ ...prev, ...patch }));
  const text = useDebounced(input, 150);
  const result = useMemo(() => runTool(() => textCleanup(text, o)), [text, o]);
  const r = result.output;

  return (
    <div class="flex flex-col gap-3">
      <TwoPane
        controls={
          <Select
            label="Blank lines"
            value={o.blankLines ?? 'collapse'}
            options={BLANKS}
            onValue={(v) => set({ blankLines: v })}
          />
        }
        inputLabel="Text"
        input={input}
        onInput={setInput}
        outputLabel={r && r.linesBefore ? `Clean text (${r.linesBefore} → ${r.linesAfter} lines)` : 'Clean text'}
        output={r?.text ?? ''}
        error={result.error}
        examples={meta.examples}
      />
      <div class="flex flex-wrap gap-x-6">
        <Toggle label="Trim each line" checked={o.trimLines ?? true} onChecked={(v) => set({ trimLines: v })} />
        <Toggle
          label="Collapse repeated spaces"
          checked={!!o.collapseSpaces}
          onChecked={(v) => set({ collapseSpaces: v })}
        />
        <Toggle label="Remove duplicate lines" checked={!!o.dedupe} onChecked={(v) => set({ dedupe: v })} />
        {o.dedupe && (
          <Toggle
            label="…ignoring case"
            checked={!!o.dedupeIgnoreCase}
            onChecked={(v) => set({ dedupeIgnoreCase: v })}
          />
        )}
        <Toggle
          label="Remove invisible characters"
          checked={!!o.stripInvisible}
          onChecked={(v) => set({ stripInvisible: v })}
        />
        <Toggle
          label="Straighten quotes and dashes"
          checked={!!o.smartQuotes}
          onChecked={(v) => set({ smartQuotes: v })}
        />
        <Toggle
          label="Tabs to 4 spaces"
          checked={!!o.tabsToSpaces}
          onChecked={(v) => set({ tabsToSpaces: v ? 4 : 0 })}
        />
      </div>
    </div>
  );
}
