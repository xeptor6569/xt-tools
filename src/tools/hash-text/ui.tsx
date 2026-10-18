import { useEffect, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import type { HashResult, OutputFormat } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const FORMATS = [
  { value: 'hex', label: 'Hex (lower case)' },
  { value: 'HEX', label: 'Hex (upper case)' },
  { value: 'base64', label: 'Base64' },
] as const satisfies ReadonlyArray<{ value: OutputFormat; label: string }>;

export default function HashTextTool() {
  const call = useWorker(createWorker, { timeoutMs: 30_000 });
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<OutputFormat>('hex');
  const [hashes, setHashes] = useState<HashResult[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const text = useDebounced(input, 150);

  useEffect(() => {
    let current = true;
    setBusy(true);
    call<HashResult[]>('hashText', text, format)
      .then(
        (value) => {
          if (!current) return;
          setHashes(value);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setHashes([]);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [text, format, call]);

  return (
    <div class="flex flex-col gap-4">
      <TextArea label="Text" value={input} onValue={setInput} rows={5} class="min-h-28" data-xt="input" />
      <div class="flex flex-wrap items-end justify-between gap-4">
        <ExampleButton examples={meta.examples} onPick={setInput} />
        <Select label="Output format" value={format} options={FORMATS} onValue={setFormat} />
      </div>
      <p class="text-xs text-muted">
        The text is hashed as UTF-8 bytes, exactly as typed (including trailing spaces and new lines).
      </p>
      <OutputRegion label="Hashes" busy={busy}>
        {hashes.length > 0 && <KeyValueList items={hashes} />}
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
