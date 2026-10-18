import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { downloadBlob } from '../../lib/download.ts';
import { runTool } from '../../lib/run-tool.ts';
import { qrGenerator, qrSvg, type Ecc, type QrCode } from './logic.ts';

const LEVELS = [
  { value: 'L', label: 'Low (7%)' },
  { value: 'M', label: 'Medium (15%)' },
  { value: 'Q', label: 'Quartile (25%)' },
  { value: 'H', label: 'High (30%)' },
] as const satisfies ReadonlyArray<{ value: Ecc; label: string }>;

const SIZES = ['256', '512', '1024', '2048'].map((v) => ({ value: v, label: `${v} × ${v} px` }));

async function downloadPng(qr: QrCode, px: number, dark: string, light: string) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, px, px);
  ctx.scale(px / qr.size, px / qr.size);
  ctx.fillStyle = dark;
  ctx.fill(new Path2D(qr.path));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) downloadBlob(blob, 'qr-code.png');
}

export default function QrGeneratorTool() {
  const [input, setInput] = useState('Hello from xt-tools');
  const [ecc, setEcc] = useState<Ecc>('M');
  const [dark, setDark] = useState('#000000');
  const [light, setLight] = useState('#ffffff');
  const [size, setSize] = useState('1024');
  const result = useMemo(() => runTool(() => qrGenerator(input, ecc)), [input, ecc]);
  const qr = result.output;

  return (
    <div class="grid gap-6 md:grid-cols-[1fr_auto]">
      <div class="flex flex-col gap-4">
        <TextArea label="Text or link" value={input} onValue={setInput} rows={4} class="min-h-24" data-xt="input" />
        <div class="flex flex-wrap items-end gap-4">
          <Select label="Error correction" value={ecc} options={LEVELS} onValue={setEcc} />
          <label class="flex flex-col gap-1 text-sm font-medium">
            Foreground
            <input
              type="color"
              value={dark}
              onInput={(e) => setDark(e.currentTarget.value)}
              class="h-10 w-16 rounded-md border border-border"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm font-medium">
            Background
            <input
              type="color"
              value={light}
              onInput={(e) => setLight(e.currentTarget.value)}
              class="h-10 w-16 rounded-md border border-border"
            />
          </label>
          <Select label="PNG size" value={size} options={SIZES} onValue={setSize} />
        </div>
        <p class="text-xs text-muted">
          Higher error correction keeps the code readable when it’s damaged or has a logo on top, but makes it denser.
          Keep strong contrast between the colours.
        </p>
      </div>
      <OutputRegion label="QR code">
        {qr && (
          <>
            <svg
              viewBox={`0 0 ${qr.size} ${qr.size}`}
              shape-rendering="crispEdges"
              role="img"
              aria-label={`QR code (version ${qr.version}) for: ${input.slice(0, 100)}`}
              class="size-64 rounded-lg border border-border"
              data-xt="qr"
            >
              <rect width="100%" height="100%" fill={light} />
              <path fill={dark} d={qr.path} />
            </svg>
            <p class="text-xs text-muted">Version {qr.version}</p>
            <div class="flex flex-wrap gap-2">
              <DownloadButton
                data={() => qrSvg(qr, dark, light)}
                filename="qr-code.svg"
                mime="image/svg+xml"
                label="Download SVG"
              />
              <Button onClick={() => void downloadPng(qr, Number(size), dark, light)}>Download PNG</Button>
            </div>
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
