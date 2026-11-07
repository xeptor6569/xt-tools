import { useEffect, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { PASSWORD_HASH_ALGOS, type PasswordHashAlgo, type PasswordHashOptions } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function PasswordHashTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('');
  const [algo, setAlgo] = useState<PasswordHashAlgo>('argon2id');
  const [memoryText, setMemoryText] = useState('19456');
  const [iterationsText, setIterationsText] = useState('2');
  const [costText, setCostText] = useState('16384');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const onAlgoChange = (next: PasswordHashAlgo) => {
    setAlgo(next);
    if (next.startsWith('pbkdf2')) setIterationsText('100000');
    else if (next.startsWith('argon2')) setIterationsText('2');
  };

  useEffect(() => {
    let current = true;
    if (input.trim() === '') {
      setOutput('');
      setError(undefined);
      setBusy(false);
      return;
    }
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const memory = Number(memoryText);
    const iterations = Number(iterationsText);
    const cost = Number(costText);
    const opts: PasswordHashOptions = {
      algo,
      saltBytes,
      ...(Number.isInteger(memory) && memory > 0 ? { memory } : {}),
      ...(Number.isInteger(iterations) && iterations > 0 ? { iterations } : {}),
      ...(Number.isInteger(cost) && cost > 0 ? { cost } : {}),
    };
    setBusy(true);
    call<string>('passwordHash', input, opts)
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
  }, [input, algo, memoryText, iterationsText, costText, call]);

  return (
    <TwoPane
      inputLabel="Password, or a verify block"
      inputPlaceholder={
        'correct horse battery staple\n\nor:\nmode: verify\nhash: $argon2id$v=19$m=19456,t=2,p=1$...\ncorrect horse battery staple'
      }
      input={input}
      onInput={setInput}
      outputLabel="PHC hash and hex digest (or match/mismatch)"
      output={output}
      error={error}
      busy={busy}
      examples={meta.examples}
      controls={
        <>
          <Select label="Algorithm" value={algo} options={PASSWORD_HASH_ALGOS} onValue={onAlgoChange} />
          {algo.startsWith('argon2') && (
            <>
              <Input
                label="Memory (KiB)"
                value={memoryText}
                onValue={setMemoryText}
                inputMode="numeric"
                class="w-32"
                hint="OWASP minimum is 19456 KiB (19 MiB) with t=2, p=1."
              />
              <Input
                label="Iterations (t)"
                value={iterationsText}
                onValue={setIterationsText}
                inputMode="numeric"
                class="w-28"
              />
            </>
          )}
          {algo === 'scrypt' && (
            <Input
              label="Cost (N)"
              value={costText}
              onValue={setCostText}
              inputMode="numeric"
              class="w-28"
              hint="Power of two, e.g. 16384."
            />
          )}
          {algo.startsWith('pbkdf2') && (
            <Input
              label="Iterations"
              value={iterationsText}
              onValue={setIterationsText}
              inputMode="numeric"
              class="w-32"
            />
          )}
        </>
      }
    />
  );
}
