import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { dateDifference } from './logic.ts';
import meta from './meta.ts';

export default function DateDifferenceTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => dateDifference(input)), [input]);

  return (
    <TwoPane
      inputLabel="Dates"
      inputPlaceholder="2026-01-01 2026-01-31"
      input={input}
      onInput={setInput}
      outputLabel="Difference"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          Two YYYY-MM-DD dates. Calendar days are the difference. Business days are Mondays–Fridays in that span,
          counting the earlier date and not the later one. No holiday calendar.
        </p>
      }
    />
  );
}
