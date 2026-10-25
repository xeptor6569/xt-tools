import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { ecKeygen, type EcCurve, type EcFormat } from './logic.ts';

export default function EcKeygenTool() {
  const [curve, setCurve] = useState<EcCurve>('ed25519');
  const [format, setFormat] = useState<EcFormat>('pem');
  const [comment, setComment] = useState('');
  const [nonce, setNonce] = useState(0);
  const [seed, setSeed] = useState<Uint8Array | null>(null);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSeed(crypto.getRandomValues(new Uint8Array(curve === 'p256' ? 48 : 32)));
  }, [curve, nonce]);

  useEffect(() => {
    if (!seed) return;
    const expected = curve === 'p256' ? 48 : 32;
    if (seed.length !== expected) return;
    let current = true;
    setBusy(true);
    ecKeygen(() => seed, curve, format, comment)
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
  }, [seed, curve, format, comment]);

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-3">
        <Select
          label="Curve"
          value={curve}
          onValue={setCurve}
          options={[
            { value: 'ed25519', label: 'Ed25519' },
            { value: 'p256', label: 'P-256' },
          ]}
        />
        <Select
          label="Format"
          value={format}
          onValue={setFormat}
          options={[
            { value: 'pem', label: 'PEM' },
            { value: 'hex', label: 'Hex' },
          ]}
        />
        <Input label="Comment" value={comment} onValue={setComment} class="w-56" data-xt="input" />
        <Button variant="primary" onClick={() => setNonce((n) => n + 1)}>
          Generate
        </Button>
      </div>
      <p class="text-xs text-muted">
        Ed25519 uses a 32-byte seed. P-256 uses a 48-byte seed and exports the SEC1 point. The comment is not stored
        inside the PEM.
      </p>
      <OutputRegion label="EC key" busy={busy}>
        <TextArea label="EC key" hideLabel value={output} readOnly rows={12} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={output} />
          <DownloadButton data={output} filename={format === 'pem' ? 'ec-key.pem' : 'ec-key.txt'} />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
