import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { loanCalculator } from './logic.ts';
import meta from './meta.ts';

export default function LoanCalculatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => loanCalculator(input)), [input]);

  return (
    <TwoPane
      inputLabel="Loan"
      inputPlaceholder="principal 1000 rate 5 years 2"
      input={input}
      onInput={setInput}
      outputLabel="Payment"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          Rate is the annual percent. Payments use standard monthly amortization. Start the line with “compound” for
          monthly compound growth instead.
        </p>
      }
    />
  );
}
