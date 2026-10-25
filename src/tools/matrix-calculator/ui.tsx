import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { matrixCalculator } from './logic.ts';
import meta from './meta.ts';

export default function MatrixCalculatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => matrixCalculator(input)), [input]);

  return (
    <TwoPane
      inputLabel="Operation and rows"
      inputPlaceholder={'det\n1 2\n3 4'}
      input={input}
      onInput={setInput}
      outputLabel="Result"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          First line: add, mul, transpose, det or inv. Then the rows (at most 8×8). Separate the two matrices of add and
          mul with a blank line. Results are fractions when they stay small.
        </p>
      }
    />
  );
}
