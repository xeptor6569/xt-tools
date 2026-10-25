import { useEffect, useMemo, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { loadImageElement } from '../../lib/image-file.ts';
import { runTool } from '../../lib/run-tool.ts';
import {
  describeImage,
  fitImage,
  formatImageSpec,
  imageConverter,
  mimeFor,
  parseImageSpec,
  type ImageFormat,
  type ImageSpec,
} from './logic.ts';
import meta from './meta.ts';

const FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
] as const satisfies ReadonlyArray<{ value: ImageFormat; label: string }>;

async function convertFile(file: File, spec: ImageSpec): Promise<{ summary: string; blob: Blob }> {
  const image = await loadImageElement(file);
  const fitted = parseImageSpec(
    formatImageSpec({ ...spec, sourceW: image.naturalWidth, sourceH: image.naturalHeight }),
  );
  const fit = fitImage(image.naturalWidth, image.naturalHeight, fitted.maxWidth, fitted.crop);
  const canvas = document.createElement('canvas');
  canvas.width = fit.dw;
  canvas.height = fit.dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw images.');
  ctx.drawImage(image, fit.sx, fit.sy, fit.sw, fit.sh, 0, 0, fit.dw, fit.dh);
  const mime = mimeFor(fitted.format);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, fitted.format === 'png' ? undefined : fitted.quality);
  });
  if (!blob) throw new Error('Could not encode that image. Try PNG.');
  return { summary: `${describeImage(fitted)}\n${blob.size} bytes`, blob };
}

export default function ImageConverterTool() {
  const [spec, setSpec] = useState('1600 900 800 png 0.92');
  const [maxDraft, setMaxDraft] = useState('800');
  const [qualityDraft, setQualityDraft] = useState('0.92');
  const [cropDraft, setCropDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const text = useMemo(() => runTool(() => imageConverter(spec)), [spec]);
  const parsed = useMemo(() => runTool(() => parseImageSpec(spec)).output, [spec]);

  useEffect(() => {
    if (!parsed) return;
    setMaxDraft(String(parsed.maxWidth));
    setQualityDraft(String(parsed.quality));
    setCropDraft(parsed.crop ? `${parsed.crop.x} ${parsed.crop.y} ${parsed.crop.w} ${parsed.crop.h}` : '');
  }, [parsed]);

  useEffect(() => {
    if (!file || !parsed) {
      setFileText(null);
      setBlob(null);
      return;
    }
    let current = true;
    setBusy(true);
    setFileError(undefined);
    void convertFile(file, parsed).then(
      (result) => {
        if (!current) return;
        setFileText(result.summary);
        setBlob(result.blob);
        setPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(result.blob);
        });
        setBusy(false);
      },
      (error: unknown) => {
        if (!current) return;
        setFileText(null);
        setBlob(null);
        setFileError(error instanceof Error ? error.message : 'Could not convert that image.');
        setBusy(false);
      },
    );
    return () => {
      current = false;
    };
  }, [file, parsed]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const rewrite = (patch: Partial<ImageSpec>) => {
    const base: ImageSpec = parsed ?? { sourceW: 1600, sourceH: 900, maxWidth: 800, format: 'png', quality: 0.92 };
    const next = { ...base, ...patch };
    if (patch.crop === undefined && Object.hasOwn(patch, 'crop')) {
      delete next.crop;
    }
    setSpec(formatImageSpec(next));
  };

  const output = fileText ?? text.output ?? '';
  const error = fileError ?? (fileText ? undefined : text.error);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Settings line: source width, source height, max width, png/jpeg/webp, quality, then an optional crop x y width
        height. Example: 1600 900 800 jpeg 0.8. Drop an image to resize it. The picture is not enlarged past its own
        size.
      </p>
      <FileDropZone
        label="Image"
        accept="image/*"
        maxBytes={25 * 1024 * 1024}
        onFiles={(files) => setFile(files[0] ?? null)}
      />
      <TwoPane
        inputLabel="Conversion"
        input={spec}
        onInput={setSpec}
        inputPlaceholder="1600 900 800 jpeg 0.8"
        outputLabel="Result"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={
          <>
            <Input
              label="Max width"
              value={maxDraft}
              inputMode="numeric"
              onValue={(value) => {
                setMaxDraft(value);
                if (/^\d+$/.test(value) && Number(value) >= 1) rewrite({ maxWidth: Number(value) });
              }}
            />
            <Select
              label="Format"
              value={parsed?.format ?? 'png'}
              options={FORMATS}
              onValue={(format) => rewrite({ format })}
            />
            <Input
              label="Quality"
              value={qualityDraft}
              onValue={(value) => {
                setQualityDraft(value);
                const n = Number(value);
                if (Number.isFinite(n) && n > 0 && n <= 100) rewrite({ quality: n > 1 ? n / 100 : n });
              }}
            />
            <Input
              label="Crop x y w h"
              value={cropDraft}
              onValue={(value) => {
                setCropDraft(value);
                const trimmed = value.trim();
                if (trimmed === '') {
                  rewrite({ crop: undefined });
                  return;
                }
                const parts = trimmed.split(/\s+/);
                if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
                  rewrite({
                    crop: {
                      x: Number(parts[0]),
                      y: Number(parts[1]),
                      w: Number(parts[2]),
                      h: Number(parts[3]),
                    },
                  });
                }
              }}
            />
          </>
        }
        actions={
          blob ? (
            <DownloadButton
              data={blob}
              filename={`image.${parsed?.format === 'jpeg' ? 'jpg' : (parsed?.format ?? 'png')}`}
              mime={blob.type || 'image/png'}
              label="Download"
            />
          ) : undefined
        }
      />
      {preview && (
        <img src={preview} alt="Converted result" class="max-h-80 max-w-full rounded-lg border border-border" />
      )}
    </div>
  );
}
