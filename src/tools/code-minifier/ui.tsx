import { useEffect, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function CodeMinifierTool() {
  const call = useWorker(createWorker);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    call<string>('codeMinifier', input)
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
      inputLabel="Input"
      input={input}
      onInput={setInput}
      outputLabel="Output"
      output={output}
      error={error}
      busy={busy}
      examples={meta.examples}
      inputPlaceholder={'html\n<p>Hello</p>'}
      controls={
        <p class="text-sm text-muted">
          Put html, css or js on the first line. The rest is the source. JavaScript is not executed; comments are
          removed with a tokenizer.
        </p>
      }
    />
  );
}
