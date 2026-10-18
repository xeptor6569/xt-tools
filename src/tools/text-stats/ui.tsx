import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { textStats } from './logic.ts';
import meta from './meta.ts';

export default function TextStatsTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => textStats(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <TextArea label="Text" value={input} onValue={setInput} rows={8} class="min-h-40" data-xt="input" />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <OutputRegion label="Results">
        {result.output && <KeyValueList items={result.output} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
