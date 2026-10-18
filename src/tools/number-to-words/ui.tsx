import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { numberToWords } from './logic.ts';
import meta from './meta.ts';

export default function NumberToWordsTool() {
  const [input, setInput] = useState('');
  const [british, setBritish] = useState(false);
  const result = useMemo(() => runTool(() => numberToWords(input, { british })), [input, british]);
  return (
    <div class="flex flex-col gap-4">
      <Input
        label="Number"
        value={input}
        onValue={setInput}
        inputMode="decimal"
        placeholder="1234.56"
        class="font-mono"
        data-xt="input"
      />
      <div class="flex flex-wrap items-center justify-between gap-4">
        <ExampleButton examples={meta.examples} onPick={setInput} />
        <Toggle label='British "and" (one hundred and one)' checked={british} onChecked={setBritish} />
      </div>
      <OutputRegion label="In words">
        {result.output && result.output.length > 0 && (
          <KeyValueList items={result.output.map((v) => ({ ...v, mono: false }))} />
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
