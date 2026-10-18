import { useMemo, useState } from 'preact/hooks';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { tableConverter, TABLE_FORMATS, type Align, type TableFormat } from './logic.ts';
import meta from './meta.ts';

const ALIGNS = [
  { value: 'none', label: 'Default' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
] as const satisfies ReadonlyArray<{ value: Align; label: string }>;

const PREVIEW_ROWS = 20;

export default function TableConverterTool() {
  const [input, setInput] = useState('');
  const [from, setFrom] = useState<TableFormat | 'auto'>('auto');
  const [to, setTo] = useState<TableFormat>('markdown');
  const [align, setAlign] = useState<Align>('none');
  const [pad, setPad] = useState(true);
  const text = useDebounced(input, 150);
  const result = useMemo(
    () => runTool(() => tableConverter(text, from, to, { align, pad })),
    [text, from, to, align, pad],
  );
  const table = result.output?.table;
  const header = table?.[0] ?? [];
  const columns = header.map((h, i) => ({ key: String(i), label: h || `Column ${i + 1}` }));
  const rows = (table?.slice(1, PREVIEW_ROWS + 1) ?? []).map((r) =>
    Object.fromEntries(header.map((_, i) => [String(i), r[i] ?? ''])),
  );

  return (
    <div class="flex flex-col gap-4">
      <TwoPane
        controls={
          <>
            <Select
              label="From"
              value={from}
              options={[{ value: 'auto', label: 'Detect' }, ...TABLE_FORMATS]}
              onValue={setFrom}
            />
            <Select label="To" value={to} options={TABLE_FORMATS} onValue={setTo} />
            {(to === 'markdown' || to === 'html') && (
              <Select label="Alignment" value={align} options={ALIGNS} onValue={setAlign} />
            )}
            {to === 'markdown' && <Toggle label="Pad columns" checked={pad} onChecked={setPad} />}
          </>
        }
        inputLabel="Table"
        input={input}
        onInput={setInput}
        inputPlaceholder={'Name,Role\nAda,Engineer'}
        outputLabel={TABLE_FORMATS.find((f) => f.value === to)?.label ?? to}
        output={result.output?.text ?? ''}
        error={result.error}
        examples={meta.examples}
      />
      {table && table.length > 1 && (
        <section aria-labelledby="table-preview" class="flex flex-col gap-2">
          <h2 id="table-preview" class="text-base font-semibold">
            Preview{table.length - 1 > PREVIEW_ROWS ? ` (first ${PREVIEW_ROWS} of ${table.length - 1} rows)` : ''}
          </h2>
          <ResultTable caption="Table preview" columns={columns} rows={rows} copy={false} />
        </section>
      )}
    </div>
  );
}
