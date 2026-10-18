import { useMemo } from 'preact/hooks';
import RememberToggle from '../../components/ui/RememberToggle.tsx';
import Select from '../../components/ui/Select.tsx';
import ShareButton from '../../components/ui/ShareButton.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { usePersistentState } from '../../components/ui/usePersistentState.ts';
import { useShareableState } from '../../components/ui/useShareableState.ts';
import { runTool } from '../../lib/run-tool.ts';
import { jsonFormat, type Indent } from './logic.ts';
import meta from './meta.ts';

const INDENTS = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
  { value: 'tab', label: 'Tabs' },
  { value: 'minify', label: 'Minify' },
] as const satisfies ReadonlyArray<{ value: Indent; label: string }>;

interface Shared {
  input: string;
  indent: Indent;
  sortKeys: boolean;
}

export default function JsonFormatTool() {
  const [input, setInput, remember] = usePersistentState('json-format', 'input', '');
  const [indent, setIndent] = usePersistentState<Indent>('json-format', 'indent', '2');
  const [sortKeys, setSortKeys] = usePersistentState('json-format', 'sort', false);
  const debounced = useDebounced(input, 150);

  useShareableState<Shared>((s) => {
    setInput(s.input);
    setIndent(s.indent);
    setSortKeys(s.sortKeys);
  });

  const result = useMemo(
    () => runTool(() => jsonFormat(debounced, { indent, sortKeys })),
    [debounced, indent, sortKeys],
  );
  const warnings = result.output?.warnings ?? [];

  return (
    <div class="flex flex-col gap-3">
      <TwoPane
        controls={
          <>
            <Select label="Indentation" value={indent} options={INDENTS} onValue={setIndent} />
            <Toggle label="Sort keys" checked={sortKeys} onChecked={setSortKeys} />
          </>
        }
        inputLabel="JSON"
        input={input}
        onInput={setInput}
        inputPlaceholder='{"paste": "JSON here"}'
        outputLabel={indent === 'minify' ? 'Minified JSON' : 'Formatted JSON'}
        output={result.output?.text ?? ''}
        error={result.error}
        examples={meta.examples}
        actions={<ShareButton state={{ input, indent, sortKeys } satisfies Shared} />}
      />
      {warnings.map((w) => (
        <p key={w} role="status" class="text-sm text-warning">
          {w}
        </p>
      ))}
      <RememberToggle {...remember} />
    </div>
  );
}
