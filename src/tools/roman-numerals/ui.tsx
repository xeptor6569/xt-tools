import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { romanNumerals } from './logic.ts';
import meta from './meta.ts';

export default function RomanNumeralsTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => romanNumerals(input)), [input]);

  return (
    <TwoPane
      inputLabel="Numbers or Roman numerals, one per line"
      input={input}
      onInput={setInput}
      outputLabel="Converted"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
