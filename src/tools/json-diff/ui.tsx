import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { jsonDiff } from './logic.ts';
import meta from './meta.ts';

export default function JsonDiffTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => jsonDiff(input)), [input]);

  return (
    <TwoPane
      inputLabel="Two JSON values"
      inputPlaceholder={'{"a":1}\n---\n{"a":2}'}
      input={input}
      onInput={setInput}
      outputLabel="Changes"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
