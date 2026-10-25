import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { downloadBlob } from '../../lib/download.ts';
import { runTool } from '../../lib/run-tool.ts';
import { qrGenerator, qrSvg, type QrCode } from '../qr-generator/logic.ts';
import { wifiQr } from './logic.ts';
import meta from './meta.ts';

async function downloadPng(qr: QrCode) {
  const px = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, px, px);
  ctx.scale(px / qr.size, px / qr.size);
  ctx.fillStyle = '#000000';
  ctx.fill(new Path2D(qr.path));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) downloadBlob(blob, 'wifi-qr.png');
}

export default function WifiQrTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => wifiQr(input)), [input]);
  const qr = useMemo(() => {
    if (!result.output) return undefined;
    return runTool(() => qrGenerator(result.output ?? '')).output;
  }, [result.output]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        One line: network name, then a space, then the password. WPA is the default. Start with WEP or nopass to change
        that, or use AUTH|SSID|password when the name contains spaces. Backslash, semicolon, comma, colon and quote are
        escaped in the payload.
      </p>
      <TwoPane
        inputLabel="Network"
        input={input}
        onInput={setInput}
        inputPlaceholder="MyNet password"
        outputLabel="Wi-Fi payload"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
      {qr && (
        <div class="flex flex-col items-start gap-2">
          <svg
            viewBox={`0 0 ${qr.size} ${qr.size}`}
            shape-rendering="crispEdges"
            role="img"
            aria-label="Wi-Fi QR code"
            class="size-64 rounded-lg border border-border bg-white"
            data-xt="qr"
          >
            <rect width="100%" height="100%" fill="#ffffff" />
            <path fill="#000000" d={qr.path} />
          </svg>
          <div class="flex flex-wrap gap-2">
            <DownloadButton data={() => qrSvg(qr)} filename="wifi-qr.svg" mime="image/svg+xml" label="Download SVG" />
            <Button onClick={() => void downloadPng(qr)}>Download PNG</Button>
          </div>
        </div>
      )}
    </div>
  );
}
