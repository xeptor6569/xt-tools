import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import type { GeneratedPgpKey, PgpMode, PgpOptions } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const MODES: ReadonlyArray<{ value: PgpMode; label: string }> = [
  { value: 'auto', label: 'Detect (encrypt / decrypt / verify / inspect)' },
  { value: 'encrypt', label: 'Encrypt' },
  { value: 'decrypt', label: 'Decrypt' },
  { value: 'sign', label: 'Cleartext sign' },
  { value: 'verify', label: 'Verify signed message' },
  { value: 'inspect', label: 'Inspect key block' },
];

export default function PgpTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<PgpMode>('auto');
  const [passphrase, setPassphrase] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [keyName, setKeyName] = useState('Alice Example');
  const [keyEmail, setKeyEmail] = useState('alice@example.com');
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
    const opts: PgpOptions = {
      mode,
      ...(passphrase ? { passphrase } : {}),
      ...(publicKey.trim() ? { publicKey } : {}),
      ...(privateKey.trim() ? { privateKey } : {}),
    };
    setBusy(true);
    call<string>('pgp', input, opts)
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
  }, [input, mode, passphrase, publicKey, privateKey, call]);

  const handleGenerateKeys = () => {
    setBusy(true);
    setError(undefined);
    call<GeneratedPgpKey>('generatePgpKeyPair', keyName, keyEmail, passphrase)
      .then(
        (generated) => {
          setPublicKey(generated.publicKey);
          setPrivateKey(generated.privateKey);
          setOutput(
            `Generated Ed25519/Curve25519 key pair\nfingerprint: ${generated.fingerprint}\n\n${generated.publicKey}`,
          );
        },
        (e: unknown) => {
          setError(errorMessage(e));
        },
      )
      .finally(() => setBusy(false));
  };

  return (
    <div class="flex flex-col gap-4">
      <TwoPane
        inputLabel="Plaintext, armored PGP message, or key block"
        inputPlaceholder={
          'passphrase: secret\nHello OpenPGP!\n\nor paste -----BEGIN PGP MESSAGE----- / -----BEGIN PGP PUBLIC KEY BLOCK-----'
        }
        input={input}
        onInput={setInput}
        outputLabel="PGP output"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={
          <>
            <Select label="Operation" value={mode} options={MODES} onValue={setMode} />
            <Input
              label="Passphrase"
              value={passphrase}
              onValue={setPassphrase}
              placeholder="Symmetric or key passphrase"
              hint="A passphrase: line at the top of the input overrides this."
            />
          </>
        }
      />
      <details class="rounded-lg border border-border bg-surface p-4">
        <summary class="cursor-pointer text-sm font-medium">Public / private keys and Curve25519 key generator</summary>
        <div class="mt-4 flex flex-col gap-4">
          <div class="flex flex-wrap items-end gap-3">
            <Input label="Name" value={keyName} onValue={setKeyName} />
            <Input label="Email" value={keyEmail} onValue={setKeyEmail} />
            <Button onClick={handleGenerateKeys} disabled={busy}>
              Generate key pair
            </Button>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <TextArea
              label="Public key (recipient / verification)"
              value={publicKey}
              onValue={setPublicKey}
              rows={5}
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
            />
            <TextArea
              label="Private key (decryption / signing)"
              value={privateKey}
              onValue={setPrivateKey}
              rows={5}
              placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
