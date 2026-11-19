import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import type { PdfTextResult } from './logic.ts';
import meta from './meta.ts';

const MAX_PDF_BYTES = 64 * 1024 * 1024;

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

function downloadName(name: string): string {
  const base = name.replace(/\.pdf$/i, '');
  return `${base || 'extracted'}.txt`;
}

function summaryOf(name: string, result: PdfTextResult): string {
  const empty =
    result.emptyPages === 0
      ? 'every selected page has a text layer'
      : result.emptyPages === result.selected
        ? 'none of the selected pages has a text layer'
        : `${result.emptyPages} selected ${result.emptyPages === 1 ? 'page has' : 'pages have'} no text layer`;
  return `${name}: read ${result.selected} of ${result.pageCount} page(s); ${empty}.`;
}

export default function PdfTextExtractorTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [output, setOutput] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    const run = async (): Promise<{ text: string; summary: string }> => {
      if (file) {
        const result = await call<PdfTextResult>('extractPdfText', file.bytes, {
          pageSpec: input.trim() === '' ? 'all' : input,
        });
        return { text: result.text, summary: summaryOf(file.name, result) };
      }
      return { text: await call<string>('pdfTextExtractor', input), summary: '' };
    };
    run()
      .then(
        (value) => {
          if (!current) return;
          setOutput(value.text);
          setSummary(value.summary);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setSummary('');
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input, file, call]);

  const loadSample = () => {
    setError(undefined);
    setInput('');
    setBusy(true);
    call<Uint8Array>('createSamplePdf', 2, 'PDF text sample').then(
      (bytes) => setFile({ name: 'pdf-text-sample.pdf', bytes }),
      (e: unknown) => {
        setError(errorMessage(e));
        setBusy(false);
      },
    );
  };

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Reads the text layer only. A scan or a photo of a page has no text to extract, and nothing on the page is sent
        anywhere.
      </p>
      <FileDropZone
        label="PDF file"
        accept=".pdf,application/pdf"
        maxBytes={MAX_PDF_BYTES}
        hint="Up to 64 MB. Read locally in a Web Worker with pdf.js (eval disabled)."
        onFiles={(picked) => {
          const next = picked[0];
          if (!next) return;
          void next.arrayBuffer().then((buf) => setFile({ name: next.name, bytes: new Uint8Array(buf) }));
        }}
      />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="secondary" onClick={loadSample} disabled={busy}>
          Load 2-page sample PDF
        </Button>
        {file && (
          <>
            <span>
              Reading <span class="font-medium">{file.name}</span>
            </span>
            <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
              Clear file
            </button>
          </>
        )}
      </div>
      {summary && <p class="text-sm text-muted">{summary}</p>}
      <TwoPane
        inputLabel="Pages"
        inputPlaceholder="all, odd, even, reverse, or 1-3, 5"
        input={input}
        onInput={setInput}
        outputLabel="Extracted text"
        output={output}
        error={error}
        busy={busy}
        examples={file ? undefined : meta.examples}
        actions={
          <DownloadButton data={output} filename={downloadName(file?.name ?? 'extracted.pdf')} label="Download .txt" />
        }
      />
    </div>
  );
}
