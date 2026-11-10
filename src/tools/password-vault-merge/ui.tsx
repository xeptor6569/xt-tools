import { useEffect, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import Input from '../../components/ui/Input.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { isKdbxBytes } from '../password-export-viewer/logic.ts';
import { splitVaultTexts, type MergeReport, type MergeSourceInput } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

interface LoadedFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  password: string;
}

function maskSecret(secret: string): string {
  const count = Math.max(4, Math.min(secret.length, 16));
  return '•'.repeat(count);
}

export default function PasswordVaultMergeTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const nextId = useRef(1);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [input, setInput] = useState('');
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState(false);
  const [report, setReport] = useState<MergeReport>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const waitingForPassword = files.filter((file) => isKdbxBytes(file.bytes) && file.password.trim() === '');

  useEffect(() => {
    let current = true;
    const sources: MergeSourceInput[] = [
      ...files
        .filter((file) => !isKdbxBytes(file.bytes) || file.password.trim() !== '')
        .map((file) => ({
          name: file.name,
          fileBytes: file.bytes,
          ...(file.password.trim() ? { masterPassword: file.password } : {}),
        })),
      ...splitVaultTexts(input).map((text, index) => ({ name: `Pasted export ${index + 1}`, text })),
    ];
    if (sources.length === 0) {
      setReport(undefined);
      setError(undefined);
      setBusy(false);
      return;
    }
    setBusy(true);
    call<MergeReport>('mergeVaultSources', sources, choices)
      .then(
        (value) => {
          if (!current) return;
          setReport(value);
          setError(undefined);
        },
        (reason: unknown) => {
          if (!current) return;
          setReport(undefined);
          setError(errorMessage(reason));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [files, input, choices, call]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Drop a Bitwarden export and the stragglers from Apple Passwords, Chrome, or another manager. Matching logins are
        folded together. Bitwarden keeps its password when another file disagrees, and you can switch that choice below.
        The download is a new vault: importing it into a vault that already has these logins will duplicate them. Cards
        and other non-login items are included only in the JSON file.
      </p>
      <FileDropZone
        label="Password exports (.kdbx, .json, .csv, .xml)"
        accept=".kdbx,.json,.csv,.xml,.1pux,text/csv,application/json"
        multiple
        maxBytes={64 * 1024 * 1024}
        hint="Bitwarden, Apple Passwords, Chrome, Edge, Firefox, 1Password, or KeePass. Files stay on this device."
        onFiles={(picked) => {
          const loaded = picked.map((file) => {
            const id = `file-${nextId.current}`;
            nextId.current += 1;
            return file
              .arrayBuffer()
              .then((buffer): LoadedFile => ({ id, name: file.name, bytes: new Uint8Array(buffer), password: '' }));
          });
          void Promise.all(loaded).then((next) => setFiles((current) => [...current, ...next]));
        }}
      />
      {files.length > 0 && (
        <ul class="flex flex-col gap-3">
          {files.map((file) => (
            <li key={file.id} class="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-medium">{file.name}</span>
                <Button
                  onClick={() => {
                    setFiles((current) => current.filter((item) => item.id !== file.id));
                  }}
                >
                  Remove
                </Button>
              </div>
              {isKdbxBytes(file.bytes) && (
                <Input
                  label={`KeePass password for ${file.name}`}
                  type="password"
                  value={file.password}
                  onValue={(password) => {
                    setFiles((current) => current.map((item) => (item.id === file.id ? { ...item, password } : item)));
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {waitingForPassword.length > 0 && (
        <p class="text-sm text-muted">
          Enter the KeePass password for {waitingForPassword.map((file) => file.name).join(', ')} to include{' '}
          {waitingForPassword.length === 1 ? 'that file' : 'those files'}.
        </p>
      )}
      <TwoPane
        inputLabel="Or paste exports, separated by a line with only ---"
        inputPlaceholder={
          'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n---\nname,url,username,password'
        }
        input={input}
        onInput={setInput}
        outputLabel="Merge summary"
        output={report?.summary ?? ''}
        error={error}
        busy={busy}
        examples={meta.examples}
        actions={
          <>
            <DownloadButton
              label="Download Bitwarden JSON"
              filename="bitwarden-import.json"
              mime="application/json"
              data={report?.bitwardenJson ?? ''}
              disabled={!report || busy}
            />
            <DownloadButton
              label="Download Bitwarden CSV"
              filename="bitwarden-import.csv"
              mime="text/csv"
              data={report?.bitwardenCsv ?? ''}
              disabled={!report || busy}
            />
          </>
        }
      />
      {report && report.conflicts.length > 0 && (
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-semibold">Passwords that disagree</h2>
            <Toggle label="Reveal passwords" checked={reveal} onChecked={setReveal} />
          </div>
          <ul class="flex flex-col gap-3">
            {report.conflicts.map((conflict, index) => {
              const selected = choices[conflict.id] ?? conflict.defaultPassword;
              return (
                <li key={conflict.id} class="rounded-lg border border-border p-3">
                  <fieldset class="flex flex-col gap-2">
                    <legend class="text-sm font-medium">
                      {conflict.host || conflict.title}
                      {conflict.username ? ` · ${conflict.username}` : ''}
                    </legend>
                    {conflict.options.map((option, optionIndex) => (
                      <label key={`${option.sourceLabel}-${optionIndex}`} class="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`merge-conflict-${index}`}
                          checked={selected === option.password}
                          onChange={() => setChoices((current) => ({ ...current, [conflict.id]: option.password }))}
                        />
                        <span>{option.sourceLabel}</span>
                        <span class="font-mono">{reveal ? option.password : maskSecret(option.password)}</span>
                      </label>
                    ))}
                  </fieldset>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
