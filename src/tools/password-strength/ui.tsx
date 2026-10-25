import { useEffect, useState } from 'preact/hooks';
import LoadingState from '../../components/ui/LoadingState.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { passwordStrength } from './logic.ts';
import meta from './meta.ts';

export default function PasswordStrengthTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const text = useDebounced(input, 200);

  useEffect(() => {
    let current = true;
    setBusy(true);
    passwordStrength(text)
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
  }, [text]);

  return (
    <div class="flex flex-col gap-4">
      {busy && <LoadingState label="Loading word lists…" />}
      <TwoPane
        inputLabel="Password"
        inputPlaceholder="Type a password. It stays in this browser."
        input={input}
        onInput={setInput}
        outputLabel="Estimate"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
      />
    </div>
  );
}
