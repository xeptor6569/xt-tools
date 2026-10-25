import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { shamir } from './logic.ts';
import meta from './meta.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export default function ShamirTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => shamir(input, random)), [input]);

  return (
    <TwoPane
      inputLabel="Secret or shares"
      inputPlaceholder={'mode: split\nthreshold: 2\nshares: 3\ncorrect horse\n\nJoin:\nmode: join\n1: hex\n2: hex'}
      input={input}
      onInput={setInput}
      outputLabel="Shares or secret"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
