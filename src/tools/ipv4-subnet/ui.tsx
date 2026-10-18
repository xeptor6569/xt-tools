import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { ipv4Subnet } from './logic.ts';
import meta from './meta.ts';

export default function Ipv4SubnetTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => ipv4Subnet(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <Input
        label="Address and prefix or mask"
        value={input}
        onValue={setInput}
        placeholder="192.168.1.10/24"
        hint="For example 10.0.0.1/8, 10.0.0.1 255.0.0.0, or a single address."
        class="font-mono"
        data-xt="input"
      />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <OutputRegion label="Subnet details">
        {result.output && result.output.length > 0 && <KeyValueList items={result.output} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
