import { useMemo, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { formatYaml, type Collections, type Quotes } from './logic.ts';
import meta from './meta.ts';

type IndentValue = '2' | '4';
const INDENTS = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
] as const satisfies ReadonlyArray<{ value: IndentValue; label: string }>;

type Width = '0' | '80' | '100' | '120';
const WIDTHS = [
  { value: '80', label: '80 columns' },
  { value: '100', label: '100 columns' },
  { value: '120', label: '120 columns' },
  { value: '0', label: 'Never fold' },
] as const satisfies ReadonlyArray<{ value: Width; label: string }>;

const COLLECTIONS = [
  { value: 'keep', label: 'Keep as written' },
  { value: 'block', label: 'Block (indented)' },
  { value: 'flow', label: 'Flow ({…} and […])' },
] as const satisfies ReadonlyArray<{ value: Collections; label: string }>;

const QUOTES = [
  { value: 'keep', label: 'Keep as written' },
  { value: 'plain', label: 'Unquoted where possible' },
  { value: 'single', label: "Single quotes ('…')" },
  { value: 'double', label: 'Double quotes ("…")' },
] as const satisfies ReadonlyArray<{ value: Quotes; label: string }>;

export default function YamlFormatterTool() {
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState<IndentValue>('2');
  const [width, setWidth] = useState<Width>('80');
  const [collections, setCollections] = useState<Collections>('keep');
  const [quotes, setQuotes] = useState<Quotes>('keep');
  const [sortKeys, setSortKeys] = useState(false);
  const [indentSeq, setIndentSeq] = useState(true);
  const debounced = useDebounced(input, 200);

  const result = useMemo(
    () =>
      runTool(() =>
        formatYaml(debounced, {
          indent: indent === '4' ? 4 : 2,
          lineWidth: Number(width),
          collections,
          quotes,
          sortKeys,
          indentSeq,
        }),
      ),
    [debounced, indent, width, collections, quotes, sortKeys, indentSeq],
  );
  const output = result.output?.text ?? '';
  const warnings = result.output?.warnings ?? [];

  return (
    <div class="flex flex-col gap-3">
      <TwoPane
        controls={
          <>
            <Select label="Indentation" value={indent} options={INDENTS} onValue={setIndent} />
            <Select label="Fold long strings at" value={width} options={WIDTHS} onValue={setWidth} />
            <Select label="Collections" value={collections} options={COLLECTIONS} onValue={setCollections} />
            <Select
              label="Strings"
              value={quotes}
              options={QUOTES}
              onValue={setQuotes}
              hint="Quote styles apply to values; keys are only unquoted."
            />
            <Toggle label="Sort keys" checked={sortKeys} onChecked={setSortKeys} />
            <Toggle label="Indent list items" checked={indentSeq} onChecked={setIndentSeq} />
          </>
        }
        inputLabel="YAML"
        input={input}
        onInput={setInput}
        inputPlaceholder="key: value"
        outputLabel="Formatted YAML"
        output={output}
        error={result.error}
        busy={debounced !== input}
        examples={meta.examples}
        actions={<DownloadButton data={output} filename="formatted.yaml" mime="application/yaml;charset=utf-8" />}
      />
      {warnings.map((w, i) => (
        <p key={i} role="status" class="rounded-lg bg-warning-bg p-3 text-sm text-warning">
          {w}
        </p>
      ))}
      <p class="text-xs text-muted">
        Comments, anchors, aliases and tags are kept. Aliases are never expanded, so the output stays the size of the
        input.
      </p>
    </div>
  );
}
