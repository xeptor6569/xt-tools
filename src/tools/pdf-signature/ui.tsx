import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { checkPdfSignaturesBytes, createSignedTestPdf, pdfSignature } from './logic.ts';
import meta from './meta.ts';

export default function PdfSignatureTool() {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    if (!file && input.trim() === '') {
      setOutput('');
      setError(undefined);
      setBusy(false);
      return;
    }
    setBusy(true);
    const task = file ? checkPdfSignaturesBytes(file.bytes).then((r) => r.text) : pdfSignature(input);
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
  }, [input, file]);

  const handleLoadSignedSample = () => {
    setBusy(true);
    setError(undefined);
    createSignedTestPdf('Alice Example', 'Contract approved')
      .then(
        (bytes) => {
          setFile({ name: 'sample-signed.pdf', bytes });
        },
        (e: unknown) => {
          setError(errorMessage(e));
        },
      )
      .finally(() => setBusy(false));
  };

  return (
    <div class="flex flex-col gap-4">
      <FileDropZone
        label="Signed PDF file"
        accept=".pdf,application/pdf"
        maxBytes={64 * 1024 * 1024}
        onFiles={(files) => {
          const f = files[0];
          if (!f) return;
          void f.arrayBuffer().then((buf) => setFile({ name: f.name, bytes: new Uint8Array(buf) }));
        }}
        hint="Up to 64 MB. Extracts /ByteRange and PKCS#7 / CMS SignedData and verifies the digest and signature locally."
      />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="secondary" onClick={handleLoadSignedSample} disabled={busy}>
          Generate and verify a signed sample PDF
        </Button>
        {file && (
          <>
            <span>
              Checking <span class="font-medium">{file.name}</span> ({file.bytes.length.toLocaleString('en')} bytes)
            </span>
            <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
              Clear file and inspect text instead
            </button>
          </>
        )}
      </div>
      <TwoPane
        inputLabel="PDF signature dictionary or Base64 PDF"
        inputPlaceholder="Drop a signed PDF above, or paste a PDF /Type /Sig dictionary or Base64-encoded PDF here"
        input={input}
        onInput={(next) => {
          setFile(undefined);
          setInput(next);
        }}
        outputLabel="Signature verification report"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
      />
    </div>
  );
}
