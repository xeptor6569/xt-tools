import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { queryStringJson } from './logic.ts';
import meta from './meta.ts';

export default function QueryStringJsonTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => queryStringJson(input)), [input]);

  return (
    <TwoPane
      inputLabel="Input"
      input={input}
      onInput={setInput}
      outputLabel="Output"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
