import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { ipv4RangeExpander } from './logic.ts';
import meta from './meta.ts';

export default function Ipv4RangeExpanderTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => ipv4RangeExpander(input)), [input]);

  return (
    <TwoPane
      inputLabel="Start and end"
      input={input}
      onInput={setInput}
      inputPlaceholder="192.168.1.0 192.168.1.255"
      outputLabel="CIDR cover"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
