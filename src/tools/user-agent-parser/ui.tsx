import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { userAgentParser } from './logic.ts';
import meta from './meta.ts';

export default function UserAgentParserTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => userAgentParser(input)), [input]);

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
