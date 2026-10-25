import { useEffect, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { jwtDebugger } from './logic.ts';
import meta from './meta.ts';

export default function JwtDebuggerTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    jwtDebugger(input)
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
  }, [input]);

  return (
    <TwoPane
      inputLabel="JWT, or headers and a payload"
      inputPlaceholder={'secret: your-256-bit-secret\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'}
      input={input}
      onInput={setInput}
      outputLabel="Decoded token"
      output={output}
      error={error}
      busy={busy}
      examples={meta.examples}
    />
  );
}
