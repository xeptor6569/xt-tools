import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { statistics } from './logic.ts';
import meta from './meta.ts';

export default function StatisticsTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => statistics(input)), [input]);

  return (
    <TwoPane
      inputLabel="Numbers"
      inputPlaceholder="1, 2, 3, 4, 5"
      input={input}
      onInput={setInput}
      outputLabel="Summary"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          Separate numbers with commas or whitespace. The standard deviation is the sample value (divide by n−1).
          Quartiles are Tukey hinges.
        </p>
      }
    />
  );
}
