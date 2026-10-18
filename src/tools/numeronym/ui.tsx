import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { numeronym } from './logic.ts';
import meta from './meta.ts';

export default function NumeronymTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => numeronym(input)), [input]);

  return (
    <TwoPane
      inputLabel="Text"
      input={input}
      onInput={setInput}
      outputLabel="Numeronyms"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
