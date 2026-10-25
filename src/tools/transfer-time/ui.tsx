import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import meta from './meta.ts';
import { transferTime } from './logic.ts';

export default function TransferTimeTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => transferTime(input)), [input]);

  return (
    <TwoPane
      inputLabel="Size and rate"
      input={input}
      onInput={setInput}
      inputPlaceholder="1.5 GiB at 100 Mbps"
      outputLabel="Duration"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="text-sm text-muted">
          GiB is 1024³ bytes and GB is 1000³ bytes. Mbps is megabits per second. MB/s is megabytes per second.
        </p>
      }
    />
  );
}
