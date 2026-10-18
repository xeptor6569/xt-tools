import { useMemo, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { listConverter, type Case, type Join, type Sort, type Split } from './logic.ts';
import meta from './meta.ts';

const SPLITS = [
  { value: 'auto', label: 'Detect' },
  { value: 'newline', label: 'New lines' },
  { value: 'comma', label: 'Commas' },
  { value: 'semicolon', label: 'Semicolons' },
  { value: 'tab', label: 'Tabs' },
  { value: 'space', label: 'Spaces' },
  { value: 'pipe', label: 'Pipes (|)' },
] as const satisfies ReadonlyArray<{ value: Split; label: string }>;

const JOINS = [
  { value: 'newline', label: 'New lines' },
  { value: 'comma-space', label: 'Comma and space' },
  { value: 'comma', label: 'Commas' },
  { value: 'semicolon', label: 'Semicolons' },
  { value: 'tab', label: 'Tabs' },
  { value: 'space', label: 'Spaces' },
  { value: 'pipe', label: 'Pipes (|)' },
] as const satisfies ReadonlyArray<{ value: Join; label: string }>;

const SORTS = [
  { value: 'none', label: 'Keep order' },
  { value: 'asc', label: 'A → Z' },
  { value: 'desc', label: 'Z → A' },
  { value: 'natural', label: 'Natural (item2 before item10)' },
  { value: 'length', label: 'By length' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'shuffle', label: 'Shuffle' },
] as const satisfies ReadonlyArray<{ value: Sort; label: string }>;

const CASES = [
  { value: 'keep', label: 'Keep case' },
  { value: 'lower', label: 'lower case' },
  { value: 'upper', label: 'UPPER CASE' },
] as const satisfies ReadonlyArray<{ value: Case; label: string }>;

const WRAPS = [
  { value: 'none', label: 'None', open: '', close: '', prefix: '', suffix: '' },
  { value: 'single', label: "'item'", open: '', close: '', prefix: "'", suffix: "'" },
  { value: 'double', label: '"item"', open: '', close: '', prefix: '"', suffix: '"' },
  { value: 'json', label: 'JSON array', open: '[', close: ']', prefix: '"', suffix: '"' },
  { value: 'sql', label: "SQL IN ('a', 'b')", open: '(', close: ')', prefix: "'", suffix: "'" },
  { value: 'custom', label: 'Custom', open: '', close: '', prefix: '', suffix: '' },
];

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export default function ListConverterTool() {
  const [input, setInput] = useState('');
  const [split, setSplit] = useState<Split>('auto');
  const [join, setJoin] = useState<Join>('comma-space');
  const [sort, setSort] = useState<Sort>('none');
  const [caseMode, setCaseMode] = useState<Case>('keep');
  const [wrap, setWrap] = useState('none');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [dedupe, setDedupe] = useState(false);
  const [trim, setTrim] = useState(true);
  const [removeEmpty, setRemoveEmpty] = useState(true);
  const [seed, setSeed] = useState(0);

  const w = WRAPS.find((x) => x.value === wrap) ?? WRAPS[0]!;
  const result = useMemo(
    () =>
      runTool(() =>
        listConverter(input, {
          split,
          join,
          sort,
          caseMode,
          dedupe,
          trim,
          removeEmpty,
          random,
          open: w.open,
          close: w.close,
          prefix: wrap === 'custom' ? prefix : w.prefix,
          suffix: wrap === 'custom' ? suffix : w.suffix,
        }),
      ),
    // `seed` re-runs a shuffle when the order is picked again.
    [input, split, join, sort, caseMode, dedupe, trim, removeEmpty, wrap, prefix, suffix, seed],
  );

  return (
    <div class="flex flex-col gap-3">
      <TwoPane
        controls={
          <>
            <Select label="Split on" value={split} options={SPLITS} onValue={setSplit} />
            <Select label="Join with" value={join} options={JOINS} onValue={setJoin} />
            <Select
              label="Order"
              value={sort}
              options={SORTS}
              onValue={(v) => {
                setSort(v);
                setSeed((s) => s + 1);
              }}
            />
            <Select label="Case" value={caseMode} options={CASES} onValue={setCaseMode} />
            <Select label="Wrap items" value={wrap} options={WRAPS} onValue={setWrap} />
            {wrap === 'custom' && (
              <>
                <Input label="Before each" value={prefix} onValue={setPrefix} class="w-24 font-mono" />
                <Input label="After each" value={suffix} onValue={setSuffix} class="w-24 font-mono" />
              </>
            )}
          </>
        }
        inputLabel="List"
        input={input}
        onInput={setInput}
        outputLabel={`Result (${result.output?.count ?? 0} items)`}
        output={result.output?.text ?? ''}
        error={result.error}
        examples={meta.examples}
      />
      <div class="flex flex-wrap gap-x-6">
        <Toggle label="Trim spaces" checked={trim} onChecked={setTrim} />
        <Toggle label="Remove empty items" checked={removeEmpty} onChecked={setRemoveEmpty} />
        <Toggle label="Remove duplicates" checked={dedupe} onChecked={setDedupe} />
      </div>
    </div>
  );
}
