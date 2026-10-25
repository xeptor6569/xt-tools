import { useEffect, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { CHECKSUM_ALGORITHMS } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const OPTIONS = CHECKSUM_ALGORITHMS.map((a) => ({
  value: a.label,
  label: a.note ? `${a.label} (${a.note.startsWith('Legacy') ? 'legacy' : 'checksum'})` : a.label,
}));

export default function FileChecksumTool() {
  const call = useWorker(createWorker, { timeoutMs: 30_000 });
  const [input, setInput] = useState('');
  const [algo, setAlgo] = useState('SHA-256');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const text = useDebounced(input, 150);

  useEffect(() => {
    let current = true;
    setBusy(true);
    const task = file
      ? call<string>('checksumBytes', file.bytes, algo, text)
      : call<string>('fileChecksum', text, algo);
    task
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
  }, [text, algo, file, call]);

  return (
    <div class="flex flex-col gap-4">
      <FileDropZone
        label="Choose a file to hash"
        onFiles={(files) => {
          const f = files[0];
          if (!f) return;
          void f.arrayBuffer().then((buf) => setFile({ name: f.name, bytes: new Uint8Array(buf) }));
        }}
        hint="Up to 64 MB. The file stays on this device. With a file loaded, the text box is the expected checksum."
      />
      {file && (
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Hashing <span class="font-medium">{file.name}</span>
          </span>
          <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
            Clear file and hash the text instead
          </button>
        </div>
      )}
      <TextArea
        label={file ? 'Expected checksum' : 'Text to hash'}
        value={input}
        onValue={setInput}
        rows={5}
        class="min-h-28"
        data-xt="input"
        placeholder={
          file
            ? 'Paste the expected hex digest to compare'
            : 'abc\n\nor a self-contained check:\nalgo: SHA-256\nexpect: ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad\nabc'
        }
      />
      <div class="flex flex-wrap items-end justify-between gap-4">
        <ExampleButton
          examples={meta.examples}
          onPick={(value) => {
            setFile(undefined);
            setInput(value);
          }}
        />
        <Select label="Algorithm" value={algo} options={OPTIONS} onValue={setAlgo} />
      </div>
      <p class="text-xs text-muted">
        Text is hashed as UTF-8. An <span class="font-mono">algo:</span> line overrides the menu, and an{' '}
        <span class="font-mono">expect:</span> line prints match or mismatch. A loaded file is hashed instead of the
        text, and the text is then only the expected digest.
      </p>
      <OutputRegion label="Checksum" busy={busy}>
        {output && <pre class="font-mono text-sm break-all whitespace-pre-wrap">{output}</pre>}
        <CopyButton text={output} />
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
