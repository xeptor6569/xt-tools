import { useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { generateRsa, parseBits } from './logic.ts';

export default function RsaKeygenTool() {
  const [bitsText, setBitsText] = useState('2048');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError(undefined);
    try {
      setOutput(await generateRsa(parseBits(bitsText)));
    } catch (e) {
      setOutput('');
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-3">
        <Input
          label="Bits (2048 or 4096)"
          value={bitsText}
          onValue={setBitsText}
          inputMode="numeric"
          class="w-40"
          data-xt="input"
        />
        <Button variant="primary" onClick={generate} disabled={busy}>
          Generate
        </Button>
      </div>
      <p class="text-xs text-muted">
        The key pair is created with WebCrypto in this browser. A blank size means 2048 bits. Nothing is uploaded.
      </p>
      {busy && <LoadingState label="Generating the RSA key…" />}
      <OutputRegion label="RSA key" busy={busy}>
        <TextArea label="RSA key" hideLabel value={output} readOnly rows={12} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={output} />
          <DownloadButton data={output} filename="rsa-key.pem" />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
