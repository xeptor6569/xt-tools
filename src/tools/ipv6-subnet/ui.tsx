import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { ipv6Subnet } from './logic.ts';
import meta from './meta.ts';

export default function Ipv6SubnetTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => ipv6Subnet(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <Input
        label="IPv6 address or prefix"
        value={input}
        onValue={setInput}
        placeholder="2001:db8::1/64"
        hint="An address or a prefix. Text is compressed with the RFC 5952 rules."
        class="font-mono"
        data-xt="input"
      />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <OutputRegion label="Prefix details">
        {result.output && result.output.length > 0 && <KeyValueList items={result.output} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
