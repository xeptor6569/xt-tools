import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { fancyText } from './logic.ts';
import meta from './meta.ts';

export default function FancyTextTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => fancyText(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <TextArea label="Text" value={input} onValue={setInput} rows={4} class="min-h-24" data-xt="input" />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <p class="text-sm text-muted">
        These are Unicode symbols, not fonts. Screen readers may read them letter by letter or skip them, and search
        engines may not match them, so avoid them for important text.
      </p>
      <OutputRegion label="Results">
        {result.output && <KeyValueList items={result.output.map((v) => ({ ...v, mono: false }))} />}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
