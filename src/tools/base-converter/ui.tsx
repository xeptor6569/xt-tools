import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { baseConverter, type FromBase } from './logic.ts';
import meta from './meta.ts';

const BASES = Array.from({ length: 35 }, (_, i) => String(i + 2));
const FROM = [
  { value: 'auto', label: 'Auto (0x, 0o, 0b prefixes; else decimal)' },
  ...BASES.map((b) => ({ value: b, label: `Base ${b}` })),
];

export default function BaseConverterTool() {
  const [input, setInput] = useState('');
  const [from, setFrom] = useState('auto');
  const [custom, setCustom] = useState('36');
  const [grouped, setGrouped] = useState(false);
  const result = useMemo(
    () =>
      runTool(() =>
        baseConverter(input, {
          from: (from === 'auto' ? 'auto' : Number(from)) as FromBase,
          custom: Number(custom),
          grouped,
        }),
      ),
    [input, from, custom, grouped],
  );

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <div class="min-w-64 flex-1">
          <Input
            label="Number"
            value={input}
            onValue={setInput}
            placeholder="255, 0xff, 0b11111111"
            class="font-mono"
            data-xt="input"
          />
        </div>
        <Select label="Input base" value={from} options={FROM} onValue={setFrom} />
        <Select
          label="Extra output base"
          value={custom}
          options={BASES.map((b) => ({ value: b, label: `Base ${b}` }))}
          onValue={setCustom}
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <ExampleButton examples={meta.examples} onPick={setInput} />
        <Toggle label="Group digits" checked={grouped} onChecked={setGrouped} />
      </div>
      <OutputRegion label="Converted number">
        {result.output && result.output.length > 0 && <KeyValueList items={result.output} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
