import { useEffect, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { loadImageElement } from '../../lib/image-file.ts';
import { openQrCameraStream, previewStream, stopTracks } from '../../lib/media-record.ts';
import { NO_QR, qrReader } from './logic.ts';

type JsQr = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' },
) => { data: string } | null;

async function loadJsQr(): Promise<JsQr> {
  const mod = (await import('jsqr')) as { default?: JsQr } | JsQr;
  const fn = typeof mod === 'function' ? mod : mod.default;
  if (typeof fn !== 'function') throw new Error('QR library failed to load.');
  return fn;
}

export default function QrReaderTool() {
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopScan = useRef<(() => void) | null>(null);
  const pending = useRef(false);

  useEffect(() => () => stopScan.current?.(), []);

  const decodeImage = async (image: CanvasImageSource, width: number, height: number) => {
    const jsQR = await loadJsQr();
    const max = 1024;
    const scale = Math.min(1, max / Math.max(width, height, 1));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('This browser cannot read image pixels.');
    ctx.drawImage(image, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);
    const code = jsQR(pixels.data, w, h, { inversionAttempts: 'attemptBoth' });
    setOutput(qrReader(code?.data ?? ''));
    setError(undefined);
  };

  const onFiles = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError(undefined);
    void (async () => {
      try {
        const image = await loadImageElement(file);
        await decodeImage(image, image.naturalWidth, image.naturalHeight);
      } catch {
        setOutput('');
        setError('Could not read a QR code from that image.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const startCamera = async () => {
    if (pending.current || stopScan.current) return;
    pending.current = true;
    setError(undefined);
    let stream: MediaStream | undefined;
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('The camera is not available in this browser. Drop an image instead.');
        return;
      }
      const jsQR = await loadJsQr();
      stream = await openQrCameraStream();
      const stopPreview = previewStream(stream, canvas.current);
      let frame = 0;
      let stopped = false;
      const tick = () => {
        if (stopped) return;
        try {
          const el = canvas.current;
          const ctx = el?.getContext('2d', { willReadFrequently: true });
          if (el && ctx && el.width > 0 && el.height > 0) {
            const pixels = ctx.getImageData(0, 0, el.width, el.height);
            const code = jsQR(pixels.data, el.width, el.height, { inversionAttempts: 'attemptBoth' });
            if (code?.data) {
              setOutput(qrReader(code.data));
              stop();
              return;
            }
          }
        } catch {
          stop();
          setError('Could not read a frame from the camera.');
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      const stop = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(frame);
        stopPreview();
        stopTracks(stream);
        setScanning(false);
        stopScan.current = null;
      };
      stopScan.current = stop;
      setScanning(true);
      frame = requestAnimationFrame(tick);
    } catch (caught) {
      stopTracks(stream);
      setScanning(false);
      stopScan.current = null;
      setError(caught instanceof Error ? caught.message : 'Could not open the camera.');
    } finally {
      pending.current = false;
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Drop a picture of a QR code. The camera starts only when you press Scan with camera.
      </p>
      <FileDropZone label="QR image" accept="image/*" maxBytes={20 * 1024 * 1024} onFiles={onFiles} />
      <div class="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void startCamera()} disabled={scanning}>
          Scan with camera
        </Button>
        <Button onClick={() => stopScan.current?.()} disabled={!scanning}>
          Stop
        </Button>
      </div>
      {busy && <LoadingState label="Reading the QR code…" />}
      <canvas
        ref={canvas}
        width={640}
        height={360}
        class={scanning ? 'max-h-80 w-full rounded-lg border border-border bg-black' : 'hidden'}
        aria-label="Camera preview"
      />
      <TextArea
        label="QR text"
        value={output || (busy ? '' : '')}
        readOnly
        data-xt="output"
        rows={4}
        class="min-h-24"
      />
      {output === NO_QR && <p class="text-sm text-muted">No QR code found.</p>}
      <ErrorMessage message={error} />
    </div>
  );
}
