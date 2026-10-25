import { useEffect, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { ToolInputError } from '../types.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

type Mode = 'encrypt' | 'decrypt';

function asText(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

export default function FileEncryptTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('encrypt');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [output, setOutput] = useState('');
  const [download, setDownload] = useState<Uint8Array | undefined>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    setDownload(undefined);
    const run = async (): Promise<{ text: string; bytes?: Uint8Array }> => {
      if (file) {
        if (!password) throw new ToolInputError('Add a file password, or clear the file and use the text box.');
        const random = crypto.getRandomValues(new Uint8Array(28));
        if (mode === 'encrypt') {
          const bytes = await call<Uint8Array>(
            'encryptBytes',
            file.bytes,
            password,
            random.slice(0, 16),
            random.slice(16, 28),
            16384,
          );
          return { text: `Encrypted ${file.bytes.length} bytes into a ${bytes.length} byte container.`, bytes };
        }
        const bytes = await call<Uint8Array>('decryptBytes', file.bytes, password);
        return { text: asText(bytes) ?? `Decrypted ${bytes.length} bytes.`, bytes };
      }
      const random = crypto.getRandomValues(new Uint8Array(28));
      return { text: await call<string>('fileEncrypt', input, random) };
    };
    run()
      .then(
        (value) => {
          if (!current) return;
          setOutput(value.text);
          setDownload(value.bytes);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setDownload(undefined);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input, password, mode, file, call]);

  return (
    <div class="flex flex-col gap-4">
      <FileDropZone
        label="Choose a file"
        onFiles={(files) => {
          const f = files[0];
          if (!f) return;
          void f.arrayBuffer().then((buf) => setFile({ name: f.name, bytes: new Uint8Array(buf) }));
        }}
        hint="Up to 64 MB. AES-GCM, one tag per 64 KiB chunk. The file stays on this device."
      />
      {file && (
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span>
            {mode === 'encrypt' ? 'Encrypting' : 'Decrypting'} <span class="font-medium">{file.name}</span>
          </span>
          <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
            Clear file and use the text box
          </button>
        </div>
      )}
      <TwoPane
        inputLabel="Password and text"
        inputPlaceholder={
          'password: secret\nn: 1024\nsalt-hex: 000102030405060708090a0b0c0d0e0f\nnonce-hex: 0102030405060708090a0b0c\nhello'
        }
        input={input}
        onInput={setInput}
        outputLabel="Result"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={
          <>
            <Select
              label="File mode"
              value={mode}
              onValue={setMode}
              options={[
                { value: 'encrypt', label: 'Encrypt file' },
                { value: 'decrypt', label: 'Decrypt file' },
              ]}
            />
            <Input
              label="File password"
              value={password}
              onValue={setPassword}
              hint="Used only when a file is loaded."
            />
          </>
        }
        actions={
          download ? (
            <DownloadButton data={download} filename={file ? `${file.name}.xtenc` : 'encrypted.bin'} />
          ) : undefined
        }
      />
    </div>
  );
}
