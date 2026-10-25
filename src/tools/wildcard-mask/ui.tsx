import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { runTool } from '../../lib/run-tool.ts';
import meta from './meta.ts';
import { wildcardMask } from './logic.ts';

export default function WildcardMaskTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => wildcardMask(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <Input
        label="Prefix, mask, or wildcard"
        value={input}
        onValue={setInput}
        placeholder="/24"
        hint="A length such as /24, a subnet mask such as 255.255.255.0, or a wildcard such as 0.0.0.255. Prefix with mask or wildcard when you need to force the reading."
        class="font-mono"
        data-xt="input"
      />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <OutputRegion label="Converted masks">
        {result.output && result.output.length > 0 && <KeyValueList items={result.output} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
