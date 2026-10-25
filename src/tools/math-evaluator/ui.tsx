import { useEffect, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function MathEvaluatorTool() {
  const call = useWorker(createWorker);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    call<string>('mathEvaluator', input)
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
      inputLabel="Expression"
      inputPlaceholder="1+2*3"
      input={input}
      onInput={setInput}
      outputLabel="Result"
      output={output}
      error={error}
      busy={busy}
      examples={meta.examples}
      controls={
        <p class="w-full text-sm text-muted">
          Operators + − * / % ^ and parentheses. Functions: sqrt, sin, cos, tan, log (base 10), ln, abs, floor, ceil,
          round, min, max, pow. Constants pi and e. Trigonometry uses degrees.
        </p>
      }
    />
  );
}
