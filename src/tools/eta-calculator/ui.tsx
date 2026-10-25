import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { etaCalculator } from './logic.ts';
import meta from './meta.ts';

export default function EtaCalculatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => etaCalculator(input)), [input]);

  return (
    <TwoPane
      inputLabel="Progress"
      inputPlaceholder="50% in 10 min"
      input={input}
      onInput={setInput}
      outputLabel="Estimate"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          Try “50% in 10 min” or “done 25 of 100 in 600 seconds”. The ETA is a duration, not a clock time.
        </p>
      }
    />
  );
}
