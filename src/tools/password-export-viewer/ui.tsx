import { useEffect, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import {
  computeEntryTotp,
  isKdbxBytes,
  TARGET_FORMATS,
  type InspectVaultOptions,
  type ParsedVault,
  type VaultTargetFormat,
} from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const TARGET_OPTIONS = [
  { value: 'auto', label: 'Keep input target: header (or summary)' },
  ...TARGET_FORMATS.map((f) => ({ value: f.value, label: f.label })),
];

export default function PasswordExportViewerTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [keyfile, setKeyfile] = useState<{ name: string; bytes: Uint8Array }>();
  const [masterPassword, setMasterPassword] = useState('');
  const [targetChoice, setTargetChoice] = useState<string>('auto');
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [revealPasswords, setRevealPasswords] = useState(false);
  const [vault, setVault] = useState<ParsedVault>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  const hasTotpEntries = useMemo(() => Boolean(vault?.entries.some((e) => e.totp.trim() !== '')), [vault]);

  useEffect(() => {
    if (!hasTotpEntries) return;
    const id = setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [hasTotpEntries]);

  useEffect(() => {
    let current = true;
    if (!file && input.trim() === '') {
      setVault(undefined);
      setError(undefined);
      setBusy(false);
      return;
    }
    setBusy(true);
    const opts: InspectVaultOptions = {
      ...(file ? { fileBytes: file.bytes } : {}),
      ...(keyfile ? { keyfileBytes: keyfile.bytes } : {}),
      ...(masterPassword ? { masterPassword } : {}),
      ...(targetChoice !== 'auto' ? { targetFormat: targetChoice as VaultTargetFormat } : {}),
    };
    call<ParsedVault>('inspectAndConvertVault', input, opts)
      .then(
        (res) => {
          if (!current) return;
          setVault(res);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setVault(undefined);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input, file, keyfile, masterPassword, targetChoice, call]);

  const folders = useMemo(() => {
    if (!vault) return [];
    return [...new Set(vault.entries.map((e) => e.folder).filter(Boolean))].sort();
  }, [vault]);

  const filteredEntries = useMemo(() => {
    if (!vault) return [];
    const q = search.trim().toLowerCase();
    return vault.entries.filter((e) => {
      if (folderFilter !== 'all' && e.folder !== folderFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q) ||
        e.folder.toLowerCase().includes(q)
      );
    });
  }, [vault, search, folderFilter]);

  const activeTargetMeta = useMemo(() => {
    const fmt = targetChoice === 'auto' ? 'summary' : (targetChoice as VaultTargetFormat);
    return TARGET_FORMATS.find((t) => t.value === fmt) ?? TARGET_FORMATS[0]!;
  }, [targetChoice]);

  const handleLoadSampleKdbx = () => {
    setBusy(true);
    setError(undefined);
    call<Uint8Array>('buildSampleKdbx4', 'correct-horse')
      .then(
        (bytes) => {
          setMasterPassword('correct-horse');
          setFile({ name: 'sample-vault.kdbx', bytes });
        },
        (e: unknown) => setError(errorMessage(e)),
      )
      .finally(() => setBusy(false));
  };

  const isKdbxLoaded = Boolean(file && isKdbxBytes(file.bytes));

  return (
    <div class="flex flex-col gap-4">
      <div class="grid gap-4 md:grid-cols-2">
        <FileDropZone
          label="Vault export file (.kdbx, .json, .csv, .xml, .1pux)"
          accept=".kdbx,.json,.csv,.xml,.1pux"
          maxBytes={64 * 1024 * 1024}
          onFiles={(picked) => {
            const f = picked[0];
            if (!f) return;
            void f.arrayBuffer().then((buf) => setFile({ name: f.name, bytes: new Uint8Array(buf) }));
          }}
          hint="Drop a KeePass .kdbx database, Bitwarden JSON/CSV, 1Password CSV/JSON, KeePass XML/CSV, or Chrome/Firefox/Safari CSV."
        />
        <FileDropZone
          label="Optional KeePass keyfile (.keyx, .key)"
          accept=".keyx,.key,.bin,.xml"
          maxBytes={4 * 1024 * 1024}
          onFiles={(picked) => {
            const f = picked[0];
            if (!f) return;
            void f.arrayBuffer().then((buf) => setKeyfile({ name: f.name, bytes: new Uint8Array(buf) }));
          }}
          hint="Used only when unlocking a KeePass .kdbx file that requires a keyfile."
        />
      </div>

      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="secondary" onClick={handleLoadSampleKdbx} disabled={busy}>
          Load sample KeePass KDBX 4 vault
        </Button>
        {file && (
          <>
            <span>
              Vault file: <span class="font-medium">{file.name}</span> ({file.bytes.length.toLocaleString('en')} bytes)
            </span>
            <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
              Clear vault file
            </button>
          </>
        )}
        {keyfile && (
          <>
            <span>
              Keyfile: <span class="font-medium">{keyfile.name}</span>
            </span>
            <button type="button" class="text-accent underline" onClick={() => setKeyfile(undefined)}>
              Clear keyfile
            </button>
          </>
        )}
      </div>

      <TwoPane
        inputLabel="Paste CSV, JSON or XML export (or drop a .kdbx file above)"
        inputPlaceholder={
          'name,url,username,password,note\nExample App,https://example.com,alice@example.com,correct-horse,Work account'
        }
        input={input}
        onInput={(next) => {
          setFile(undefined);
          setInput(next);
        }}
        outputLabel="Converted export / summary"
        output={vault?.converted ?? ''}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={
          <>
            <Select label="Convert output to" value={targetChoice} options={TARGET_OPTIONS} onValue={setTargetChoice} />
            <Input
              label={isKdbxLoaded ? 'KDBX master password (required)' : 'KDBX master password'}
              type="password"
              value={masterPassword}
              onValue={setMasterPassword}
              placeholder="Master password for .kdbx"
            />
          </>
        }
        actions={
          vault && vault.converted ? (
            <DownloadButton
              data={vault.converted}
              filename={`vault-export-${activeTargetMeta.value}.${activeTargetMeta.ext}`}
              mime={activeTargetMeta.mime}
              label={`Download .${activeTargetMeta.ext}`}
            />
          ) : undefined
        }
      />

      {vault && vault.entries.length > 0 && (
        <section
          aria-label="Vault entries inspector"
          class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold">
                Vault inspector ({filteredEntries.length} of {vault.entries.length} entries · detected{' '}
                <span class="font-mono">{vault.sourceFormat}</span>)
              </h2>
              <p class="text-xs text-muted">
                All passwords and TOTP codes stay in this browser tab and are never stored or sent over the network.
              </p>
            </div>
            <div class="flex flex-wrap items-end gap-3">
              <Input
                label="Filter entries"
                value={search}
                onValue={setSearch}
                placeholder="Search title, username, URL, folder..."
                class="w-60"
              />
              {folders.length > 0 && (
                <Select
                  label="Folder"
                  value={folderFilter}
                  options={[{ value: 'all', label: 'All folders' }, ...folders.map((f) => ({ value: f, label: f }))]}
                  onValue={setFolderFilter}
                />
              )}
              <Toggle label="Reveal passwords" checked={revealPasswords} onChecked={setRevealPasswords} />
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            {filteredEntries.slice(0, 200).map((entry) => {
              const otp = entry.totp ? computeEntryTotp(entry.totp, nowSeconds) : undefined;
              return (
                <div key={entry.id} class="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3 text-sm">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="font-semibold">{entry.title}</div>
                      {entry.folder && <div class="text-xs text-muted">Folder: {entry.folder}</div>}
                    </div>
                    <span class="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted">
                      {entry.type}
                    </span>
                  </div>

                  {entry.url && (
                    <div class="truncate text-xs text-muted">
                      URL: <span class="font-mono">{entry.url}</span>
                    </div>
                  )}

                  {entry.username && (
                    <div class="flex items-center justify-between gap-2">
                      <span class="truncate font-mono text-xs">User: {entry.username}</span>
                      <CopyButton text={entry.username} label="Copy user" />
                    </div>
                  )}

                  {entry.password && (
                    <div class="flex items-center justify-between gap-2">
                      <span class="truncate font-mono text-xs">
                        Password: {revealPasswords ? entry.password : '••••••••••••'}
                      </span>
                      <CopyButton text={entry.password} label="Copy password" />
                    </div>
                  )}

                  {otp && (
                    <div class="flex items-center justify-between gap-2 rounded bg-surface px-2 py-1">
                      <span class="font-mono text-xs font-semibold">
                        TOTP: {otp.code} <span class="font-normal text-muted">({otp.remainingSeconds}s)</span>
                      </span>
                      <CopyButton text={otp.code} label="Copy TOTP" />
                    </div>
                  )}

                  {entry.notes && (
                    <pre class="max-h-24 overflow-auto rounded bg-surface p-2 font-mono text-xs whitespace-pre-wrap text-muted">
                      {entry.notes}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
