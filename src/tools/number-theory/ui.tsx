import { useEffect, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function NumberTheoryTool() {
  const call = useWorker(createWorker);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    call<string>('numberTheory', input)
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
      inputLabel="Command"
      inputPlaceholder="factor 84"
      input={input}
      onInput={setInput}
      outputLabel="Result"
      output={output}
      error={error}
      busy={busy}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          factor 84, gcd 12 18, lcm 4 6, or prime 97. Factorization uses trial division and Pollard Rho, and stops if
          the number is above 64 bits or takes too long.
        </p>
      }
    />
  );
}
