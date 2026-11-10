import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import type { ExtractedPdfImage } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function PdfImageExtractorTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [images, setImages] = useState<ExtractedPdfImage[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    if (!file && input.trim() === '') {
      setOutput('');
      setImages([]);
      setError(undefined);
      setBusy(false);
      return;
    }
    setBusy(true);
    const task = file
      ? call<{ summary: string; images: ExtractedPdfImage[] }>('extractImagesFromPdf', file.bytes)
      : call<string>('pdfImageExtractor', input).then((summary) => ({ summary, images: [] }));

    task
      .then(
        (res) => {
          if (!current) return;
          setOutput(res.summary);
          setImages(res.images);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setImages([]);
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

  const handleLoadSample = () => {
    setBusy(true);
    call<Uint8Array>('createSamplePdfWithImages')
      .then(
        (bytes) => setFile({ name: 'sample-images.pdf', bytes }),
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
        hint="Up to 64 MB. JPEG (/DCTDecode) streams are saved directly without re-compression; Flate streams are saved as PNG."
      />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="secondary" onClick={handleLoadSample} disabled={busy}>
          Load sample PDF with 2 images
        </Button>
        {file && (
          <>
            <span>
              Inspecting <span class="font-medium">{file.name}</span>
            </span>
            <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
              Clear file
            </button>
          </>
        )}
      </div>
      <TwoPane
        inputLabel="Image XObject dictionary or Base64 PDF"
        inputPlaceholder="<< /Type /XObject /Subtype /Image /Width 640 /Height 480 /ColorSpace /DeviceRGB /Filter /DCTDecode >>"
        input={input}
        onInput={(next) => {
          setFile(undefined);
          setInput(next);
        }}
        outputLabel="Extracted images"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
      />
      {images.length > 0 && (
        <section aria-label="Extracted image downloads" class="grid gap-3 sm:grid-cols-2">
          {images.map((img) => (
            <div
              key={img.index}
              class="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <div>
                <div class="font-medium">
                  {img.filename} ({img.width}×{img.height})
                </div>
                <div class="text-xs text-muted">
                  {img.colorSpace} · {img.filter} · {img.bytes.length.toLocaleString('en')} bytes
                </div>
              </div>
              <DownloadButton data={img.bytes} filename={img.filename} mime={img.mime} label="Download" />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
