import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { ipv4Converter } from './logic.ts';
import meta from './meta.ts';

export default function Ipv4ConverterTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => ipv4Converter(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <Input
        label="IPv4 address"
        value={input}
        onValue={setInput}
        placeholder="192.168.1.1"
        hint="Dotted decimal, a decimal integer, 0x hex, or 32-bit binary."
        class="font-mono"
        data-xt="input"
      />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <OutputRegion label="Converted forms">
        {result.output && result.output.length > 0 && <KeyValueList items={result.output} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
