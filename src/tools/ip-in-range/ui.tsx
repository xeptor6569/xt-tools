import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { ipInRange } from './logic.ts';
import meta from './meta.ts';

export default function IpInRangeTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => ipInRange(input)), [input]);

  return (
    <TwoPane
      inputLabel="Address, then ranges"
      input={input}
      onInput={setInput}
      inputPlaceholder={'192.168.1.50\n192.168.1.0/24\n10.0.0.0/8\n192.168.1.100-192.168.1.200'}
      outputLabel="Matches"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
