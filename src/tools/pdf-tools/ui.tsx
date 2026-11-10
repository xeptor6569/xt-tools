import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import type { PdfJobOptions, PdfJobResult, PdfOperation, RotationAngle } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const OPERATIONS: ReadonlyArray<{ value: PdfOperation; label: string }> = [
  { value: 'extract', label: 'Split / extract pages' },
  { value: 'merge', label: 'Merge PDFs' },
  { value: 'rotate', label: 'Rotate pages' },
  { value: 'compress', label: 'Compress / optimize' },
];

const ROTATIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '90', label: '90° clockwise' },
  { value: '180', label: '180°' },
  { value: '270', label: '270° clockwise (90° CCW)' },
];

export default function PdfToolsTool() {
  const call = useWorker(createWorker, { timeoutMs: 60_000 });
  const [input, setInput] = useState('pages: 8\nselect: 1-3, 6, 8-7\nrotate: 90');
  const [operation, setOperation] = useState<PdfOperation>('extract');
  const [pageSpec, setPageSpec] = useState('1-3');
  const [rotation, setRotation] = useState('90');
  const [stripMetadata, setStripMetadata] = useState(true);
  const [files, setFiles] = useState<Array<{ name: string; bytes: Uint8Array }>>([]);
  const [output, setOutput] = useState('');
  const [download, setDownload] = useState<Uint8Array>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    setDownload(undefined);

    const run = async (): Promise<{ text: string; bytes?: Uint8Array }> => {
      if (files.length > 0) {
        const opts: PdfJobOptions = {
          operation,
          pageSpec,
          rotation: Number(rotation) as RotationAngle,
          stripMetadata,
        };
        const res = await call<PdfJobResult>(
          'processPdfFiles',
          files.map((f) => f.bytes),
          opts,
        );
        return { text: res.summary, bytes: res.bytes };
      }
      return { text: await call<string>('pdfTools', input) };
    };

    run()
      .then(
        (res) => {
          if (!current) return;
          setOutput(res.text);
          setDownload(res.bytes);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setDownload(undefined);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input, files, operation, pageSpec, rotation, stripMetadata, call]);

  const handleLoadSample = () => {
    setBusy(true);
    call<Uint8Array>('createSamplePdf', 5, 'Sample Report')
      .then(
        (bytes) => {
          setFiles([{ name: 'sample-5pages.pdf', bytes }]);
        },
        (e: unknown) => setError(errorMessage(e)),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div class="flex flex-col gap-4">
      <FileDropZone
        label="PDF file(s)"
        accept=".pdf,application/pdf"
        multiple
        maxBytes={64 * 1024 * 1024}
        onFiles={(picked) => {
          void Promise.all(
            picked.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
          ).then((loaded) => setFiles(loaded));
        }}
        hint="Drop one or more PDF files (up to 64 MB). Everything runs locally in a Web Worker."
      />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="secondary" onClick={handleLoadSample} disabled={busy}>
          Load 5-page sample PDF
        </Button>
        {files.length > 0 && (
          <>
            <span>
              Loaded: <span class="font-medium">{files.map((f) => f.name).join(', ')}</span>
            </span>
            <button type="button" class="text-accent underline" onClick={() => setFiles([])}>
              Clear PDF file(s)
            </button>
          </>
        )}
      </div>
      <TwoPane
        inputLabel="Page selection spec (when no PDF is loaded)"
        inputPlaceholder={'pages: 8\nselect: 1-3, 6, 8-7\nrotate: 90'}
        input={input}
        onInput={setInput}
        outputLabel="Result"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={
          <>
            <Select label="Operation" value={operation} options={OPERATIONS} onValue={setOperation} />
            {(operation === 'extract' || operation === 'rotate') && (
              <Input
                label="Pages"
                value={pageSpec}
                onValue={setPageSpec}
                placeholder="1-3, 5 or all / odd / even / reverse"
                class="w-48 font-mono"
              />
            )}
            {operation === 'rotate' && (
              <Select label="Angle" value={rotation} options={ROTATIONS} onValue={setRotation} />
            )}
            <Toggle label="Strip metadata" checked={stripMetadata} onChecked={setStripMetadata} />
          </>
        }
        actions={
          download ? (
            <DownloadButton
              data={download}
              filename={`output-${operation}.pdf`}
              mime="application/pdf"
              label="Download PDF"
            />
          ) : undefined
        }
      />
    </div>
  );
}
