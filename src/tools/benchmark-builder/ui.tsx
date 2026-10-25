import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { benchmarkBuilder } from './logic.ts';
import meta from './meta.ts';

export default function BenchmarkBuilderTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => benchmarkBuilder(input)), [input]);

  return (
    <TwoPane
      inputLabel="Measurements"
      inputPlaceholder={'parse 20\nrender 10'}
      input={input}
      onInput={setInput}
      outputLabel="Comparison"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          One “name value” per line. Values are numbers you already measured. Lower is faster. Nothing here is executed.
        </p>
      }
    />
  );
}
