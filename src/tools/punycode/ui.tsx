import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { punycode } from './logic.ts';
import meta from './meta.ts';

export default function PunycodeTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => punycode(input)), [input]);

  return (
    <TwoPane
      inputLabel="Domains or email addresses, one per line"
      input={input}
      onInput={setInput}
      outputLabel="Converted"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
