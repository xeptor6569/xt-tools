import { useEffect, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function HostsMergerTool() {
  const call = useWorker(createWorker);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    call<string>('hostsMerger', input)
      .then(
        (value) => {
          if (!current) return;
          setOutput(value);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input, call]);

  return (
    <TwoPane
      inputLabel="Hosts and adblock lines"
      input={input}
      onInput={setInput}
      inputPlaceholder={'127.0.0.1 localhost\n||ads.example^\n0.0.0.0 ads.example'}
      outputLabel="Merged hosts"
      output={output}
      error={error}
      busy={busy}
      examples={meta.examples}
    />
  );
}
