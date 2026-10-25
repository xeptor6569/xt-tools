import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { unitCalculator } from './logic.ts';
import meta from './meta.ts';

export default function UnitCalculatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => unitCalculator(input)), [input]);

  return (
    <TwoPane
      inputLabel="Expression"
      inputPlaceholder="5 km + 20 m"
      input={input}
      onInput={setInput}
      outputLabel="Result"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          Length, mass, time and temperature. Examples: “5 km + 20 m”, “10 km/h to m/s”, “10 F to C”. Temperature is
          only converted with “to”. Trigonometry uses degrees.
        </p>
      }
    />
  );
}
