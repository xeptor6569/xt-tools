import { useEffect, useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { DEFAULT_ZONES, worldClock } from './logic.ts';
import meta from './meta.ts';

const DEFAULT = DEFAULT_ZONES.join('\n');

export default function WorldClockTool() {
  const [input, setInput] = useState(DEFAULT);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => runTool(() => worldClock(input, now)), [input, now]);

  return (
    <TwoPane
      inputLabel="Time zones"
      inputPlaceholder="UTC"
      input={input}
      onInput={setInput}
      outputLabel="Clocks"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          IANA time zones, separated by commas or lines. Empty input shows UTC, New York, London and Tokyo.
        </p>
      }
    />
  );
}
