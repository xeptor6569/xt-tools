import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { sshEd25519, sshRsa } from './logic.ts';

type Algorithm = 'ed25519' | 'rsa2048' | 'rsa4096';

export default function SshKeygenTool() {
  const [algo, setAlgo] = useState<Algorithm>('ed25519');
  const [comment, setComment] = useState('');
  const [nonce, setNonce] = useState(0);
  const [seed, setSeed] = useState<Uint8Array | null>(null);
  const [rsaText, setRsaText] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const rsa = algo !== 'ed25519';

  useEffect(() => {
    if (algo !== 'ed25519') {
      setSeed(null);
      return;
    }
    setSeed(crypto.getRandomValues(new Uint8Array(32)));
  }, [algo, nonce]);

  useEffect(() => {
    if (!seed) return;
    let current = true;
    setBusy(true);
    sshEd25519(seed, comment)
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
  }, [seed, comment]);

  async function generateRsa() {
    setBusy(true);
    setError(undefined);
    try {
      const text = await sshRsa(comment, algo === 'rsa4096' ? 4096 : 2048);
      setRsaText(text);
    } catch (e) {
      setRsaText('');
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const shown = rsa ? rsaText : output;

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-3">
        <Select
          label="Algorithm"
          value={algo}
          onValue={(value) => {
            setAlgo(value);
            setRsaText('');
            setError(undefined);
          }}
          options={[
            { value: 'ed25519', label: 'Ed25519' },
            { value: 'rsa2048', label: 'RSA 2048' },
            { value: 'rsa4096', label: 'RSA 4096' },
          ]}
        />
        <Input label="Comment" value={comment} onValue={setComment} class="w-56" data-xt="input" />
        <Button variant="primary" onClick={() => (rsa ? void generateRsa() : setNonce((n) => n + 1))} disabled={busy}>
          Generate
        </Button>
      </div>
      {rsa && <p class="text-xs text-muted">RSA needs WebCrypto. Ed25519 still works without it.</p>}
      {busy && <LoadingState label="Generating the SSH key…" />}
      <OutputRegion label="SSH key" busy={busy}>
        <TextArea label="SSH key" hideLabel value={shown} readOnly rows={12} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={shown} />
          <DownloadButton data={shown} filename="ssh-key.txt" />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
