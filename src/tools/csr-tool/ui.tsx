import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import { csrTool, generateCsr } from './logic.ts';
import meta from './meta.ts';

export default function CsrToolTool() {
  const [input, setInput] = useState('');
  const [generated, setGenerated] = useState('');
  const [genError, setGenError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const decoded = useMemo(() => runTool(() => csrTool(input)), [input]);
  const showingPem = input.includes('-----BEGIN');
  const output = showingPem ? (decoded.output ?? '') : generated;
  const error = showingPem ? decoded.error : genError;

  async function onGenerate() {
    setBusy(true);
    try {
      setGenerated(await generateCsr(input));
      setGenError(undefined);
    } catch (e) {
      setGenerated('');
      setGenError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <p class="text-xs text-muted">
        Paste a PEM certificate request to decode the subject and signature algorithm. To build one, type a subject such
        as CN=example.com, O=Example and press Generate. Building a request needs WebCrypto and stays in this browser.
      </p>
      {busy && <LoadingState label="Generating the request…" />}
      <TwoPane
        inputLabel="PEM request or subject"
        inputPlaceholder={'CN=example.com, O=Example'}
        input={input}
        onInput={(value) => {
          setInput(value);
          setGenerated('');
          setGenError(undefined);
        }}
        outputLabel="Decoded request or new PEM"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
        actions={
          <Button variant="primary" onClick={onGenerate} disabled={busy || showingPem}>
            Generate
          </Button>
        }
      />
    </div>
  );
}
