import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { urlParser } from './logic.ts';
import meta from './meta.ts';

export default function UrlParserTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => urlParser(input)), [input]);

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
