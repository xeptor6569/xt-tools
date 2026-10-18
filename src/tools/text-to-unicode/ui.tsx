import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { textToUnicode } from './logic.ts';
import meta from './meta.ts';

export default function TextToUnicodeTool() {
  const [input, setInput] = useState('');
  const [all, setAll] = useState(false);
  const result = useMemo(() => runTool(() => textToUnicode(input, { all })), [input, all]);

  return (
    <div class="flex flex-col gap-4">
      <TextArea label="Text" value={input} onValue={setInput} rows={4} class="min-h-24" data-xt="input" />
      <div class="flex flex-wrap items-center justify-between gap-4">
        <ExampleButton examples={meta.examples} onPick={setInput} />
        <Toggle label="Escape plain ASCII too" checked={all} onChecked={setAll} />
      </div>
      <OutputRegion label="Results">
        {result.output && <KeyValueList items={result.output} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
