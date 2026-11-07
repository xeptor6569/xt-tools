import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import type { PdfImageFormat, PdfRenderOptions, RenderedPdfPage } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const FORMATS: ReadonlyArray<{ value: PdfImageFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

const DPIS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '72', label: '72 DPI (1x)' },
  { value: '144', label: '144 DPI (2x)' },
  { value: '216', label: '216 DPI (3x)' },
  { value: '300', label: '300 DPI (print)' },
];

export default function PdfToImagesTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('612 792 144 png 0.92');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [format, setFormat] = useState<PdfImageFormat>('png');
  const [dpi, setDpi] = useState('144');
  const [pageSpec, setPageSpec] = useState('all');
  const [pages, setPages] = useState<RenderedPdfPage[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    const run = async (): Promise<{ summary: string; pages: RenderedPdfPage[] }> => {
      if (file) {
        const opts: PdfRenderOptions = {
          format,
          dpi: Number(dpi) || 144,
          pageSpec,
        };
        return await call<{ summary: string; pages: RenderedPdfPage[] }>('renderPdfToImages', file.bytes, opts);
      }
      const summary = await call<string>('pdfToImages', input);
      return { summary, pages: [] };
    };

    run()
      .then(
        (res) => {
          if (!current) return;
          setOutput(res.summary);
          setPages(res.pages);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setPages([]);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input, file, format, dpi, pageSpec, call]);

  const handleLoadSample = () => {
    setBusy(true);
    call<Uint8Array>('createSamplePdf', 2, 'PDF to Images Sample')
      .then(
        (bytes) => setFile({ name: 'sample-2pages.pdf', bytes }),
        (e: unknown) => setError(errorMessage(e)),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div class="flex flex-col gap-4">
      <FileDropZone
        label="PDF file"
        accept=".pdf,application/pdf"
        maxBytes={64 * 1024 * 1024}
        onFiles={(picked) => {
          const f = picked[0];
          if (!f) return;
          void f.arrayBuffer().then((buf) => setFile({ name: f.name, bytes: new Uint8Array(buf) }));
        }}
        hint="Up to 64 MB. Rendered locally in a Web Worker with pdf.js (eval disabled)."
      />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="secondary" onClick={handleLoadSample} disabled={busy}>
          Load 2-page sample PDF
        </Button>
        {file && (
          <>
            <span>
              Rendering <span class="font-medium">{file.name}</span>
            </span>
            <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
              Clear file
            </button>
          </>
        )}
      </div>
      <TwoPane
        inputLabel="Page size and DPI calculator (when no PDF is loaded)"
        inputPlaceholder="612 792 144 png 0.92"
        input={input}
        onInput={setInput}
        outputLabel="Rendered pages"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={
          <>
            <Select label="Format" value={format} options={FORMATS} onValue={setFormat} />
            <Select label="Resolution" value={dpi} options={DPIS} onValue={setDpi} />
            <Input
              label="Pages"
              value={pageSpec}
              onValue={setPageSpec}
              placeholder="all or 1-3, 5"
              class="w-36 font-mono"
            />
          </>
        }
      />
      {pages.length > 0 && (
        <section aria-label="Rendered page images" class="grid gap-3 sm:grid-cols-2">
          {pages.map((p) => (
            <div
              key={p.pageNumber}
              class="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <div>
                <div class="font-medium">
                  Page {p.pageNumber} ({p.widthPx}×{p.heightPx} px)
                </div>
                <div class="text-xs text-muted">
                  {p.filename}
                  {p.bytes ? ` · ${p.bytes.length.toLocaleString('en')} bytes` : ''}
                </div>
              </div>
              {p.bytes && <DownloadButton data={p.bytes} filename={p.filename} mime={p.mime} label="Download" />}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
