import { useMemo, useState } from 'preact/hooks';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { exifViewer, formatExif, NO_EXIF } from './logic.ts';
import meta from './meta.ts';

type ExifrParse = (data: Blob, options?: Record<string, unknown>) => Promise<unknown>;

async function loadParse(): Promise<ExifrParse> {
  const mod = (await import('exifr')) as { parse?: ExifrParse; default?: { parse?: ExifrParse } };
  const parse = mod.parse ?? mod.default?.parse;
  if (!parse) throw new Error('EXIF library failed to load.');
  return parse;
}

export default function ExifViewerTool() {
  const [input, setInput] = useState('');
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [preferFile, setPreferFile] = useState(false);
  const text = useMemo(() => runTool(() => exifViewer(input)), [input]);

  const onFiles = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setFileError(undefined);
    setPreferFile(true);
    void (async () => {
      try {
        const parse = await loadParse();
        const data = await parse(file, {
          xmp: false,
          icc: false,
          iptc: false,
          jfif: false,
          ihdr: false,
          makerNote: false,
          sanitize: true,
          mergeOutput: true,
          gps: true,
          exif: true,
          tiff: true,
        });
        setFileText(data ? formatExif(data) : NO_EXIF);
      } catch {
        setFileText(null);
        setFileError('Could not read EXIF from that file.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const output = preferFile ? (fileText ?? '') : (text.output ?? '');
  const error = preferFile ? fileError : text.error;

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Drop a JPEG or HEIC. Fields are listed as text, including GPS numbers. Nothing is sent to a map.
      </p>
      <FileDropZone label="Image" accept="image/*" maxBytes={40 * 1024 * 1024} onFiles={onFiles} />
      {busy && <LoadingState label="Reading EXIF…" />}
      <TwoPane
        inputLabel="Or EXIF JSON"
        input={input}
        onInput={(value) => {
          setPreferFile(false);
          setInput(value);
        }}
        inputPlaceholder='{"Make":"Canon"}'
        outputLabel="Fields"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
      />
    </div>
  );
}
