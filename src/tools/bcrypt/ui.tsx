import { useEffect, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { DEFAULT_ROUNDS, MAX_ROUNDS, MIN_ROUNDS } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function BcryptTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('');
  const [roundsText, setRoundsText] = useState(String(DEFAULT_ROUNDS));
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    if (input.trim() === '') {
      setOutput('');
      setError(undefined);
      setBusy(false);
      return;
    }
    const rounds = Number(roundsText);
    const fallback = Number.isInteger(rounds) ? rounds : DEFAULT_ROUNDS;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    setBusy(true);
    call<string>('bcrypt', input, salt, fallback)
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
  }, [input, roundsText, call]);

  return (
    <TwoPane
      inputLabel="Password, or a compare block"
      inputPlaceholder={'password\n\nor:\nmode: compare\nhash: $2a$...\npassword'}
      input={input}
      onInput={setInput}
      outputLabel="Hash or comparison"
      output={output}
      error={error}
      busy={busy}
      examples={meta.examples}
      controls={
        <Input
          label={`Cost (${MIN_ROUNDS}–${MAX_ROUNDS})`}
          value={roundsText}
          onValue={setRoundsText}
          inputMode="numeric"
          class="w-28"
          hint="A rounds: line in the text overrides this. 10 is the default; 12 is the maximum."
        />
      }
    />
  );
}
