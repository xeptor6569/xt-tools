import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { unitConverter } from './logic.ts';
import { CATEGORIES } from './units.ts';

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.id, label: c.label }));

export default function UnitConverterTool() {
  const [input, setInput] = useState('1');
  const [category, setCategory] = useState('length');
  const units = CATEGORIES.find((c) => c.id === category)?.units ?? [];
  const [from, setFrom] = useState('m');
  const unit = units.some((u) => u.id === from) ? from : (units[0]?.id ?? '');
  const result = useMemo(() => runTool(() => unitConverter(input, category, unit)), [input, category, unit]);

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <Select
          label="Quantity"
          value={category}
          options={CATEGORY_OPTIONS}
          onValue={(c) => {
            setCategory(c);
            setFrom(CATEGORIES.find((x) => x.id === c)?.units[0]?.id ?? '');
          }}
        />
        <Input
          label="Value"
          value={input}
          onValue={setInput}
          inputMode="decimal"
          class="w-40 font-mono"
          data-xt="input"
        />
        <Select
          label="Unit"
          value={unit}
          options={units.map((u) => ({ value: u.id, label: u.label }))}
          onValue={setFrom}
        />
      </div>
      {category === 'data' && (
        <p class="text-sm text-muted">
          kB, MB and GB are powers of 1000 (used by drive makers and network speeds). KiB, MiB and GiB are powers of
          1024 (used by most operating systems for memory and file sizes).
        </p>
      )}
      <OutputRegion label="Converted values">
        {result.output && result.output.length > 0 && <KeyValueList items={result.output} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
