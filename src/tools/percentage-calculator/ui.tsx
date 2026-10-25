import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { percentageCalculator } from './logic.ts';
import meta from './meta.ts';

export default function PercentageCalculatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => percentageCalculator(input)), [input]);

  return (
    <TwoPane
      inputLabel="Questions"
      inputPlaceholder="20% of 80"
      input={input}
      onInput={setInput}
      outputLabel="Answers"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          One question per line: “20% of 80”, “20 is what % of 80”, “80 is 20% of what”, or “from 80 to 100”.
        </p>
      }
    />
  );
}
