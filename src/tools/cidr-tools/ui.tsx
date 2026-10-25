import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { cidrTools } from './logic.ts';
import meta from './meta.ts';

export default function CidrToolsTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => cidrTools(input)), [input]);

  return (
    <TwoPane
      inputLabel="CIDR prefixes"
      input={input}
      onInput={setInput}
      inputPlaceholder={'10.0.0.0/8\n10.1.0.0/16\n192.168.0.0/24\n192.168.1.0/24'}
      outputLabel="Aggregate and overlaps"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
