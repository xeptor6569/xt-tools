import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import Button from '../../components/ui/Button.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { downloadBlob } from '../../lib/download.ts';
import { loadImageElement } from '../../lib/image-file.ts';
import { runTool } from '../../lib/run-tool.ts';
import { hueStops, hueVariants, rotateHue } from './logic.ts';
import meta from './meta.ts';

interface Frame {
  deg: number;
  hex?: string;
  rgba?: Uint8ClampedArray;
  width: number;
  height: number;
}

function VariantCanvas({ frame }: { frame: Frame }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (frame.rgba) {
      canvas.width = frame.width;
      canvas.height = frame.height;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height), 0, 0);
      return;
    }
    canvas.width = 160;
    canvas.height = 96;
    ctx.fillStyle = frame.hex ?? '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [frame]);

  return (
    <figure class="flex flex-col gap-1">
      <canvas
        ref={ref}
        role="img"
        aria-label={`Hue ${frame.deg} degrees`}
        class="h-auto max-w-full rounded-md border border-border"
      />
      <figcaption class="text-xs text-muted">{frame.deg}°</figcaption>
      <Button
        onClick={() => {
          const canvas = ref.current;
          if (!canvas) return;
          canvas.toBlob((blob) => {
            if (blob) downloadBlob(blob, `hue-${frame.deg}.png`);
          }, 'image/png');
        }}
      >
        Download
      </Button>
    </figure>
  );
}

export default function HueVariantsTool() {
  const [input, setInput] = useState('#ff0000');
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [fileError, setFileError] = useState<string>();
  const text = useMemo(() => runTool(() => hueVariants(input)), [input]);
  const swatches = useMemo(() => {
    try {
      return hueStops(input).map((stop) => ({ deg: stop.deg, hex: stop.hex, width: 160, height: 96 }));
    } catch {
      return [];
    }
  }, [input]);

  const onFiles = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileError(undefined);
    void (async () => {
      try {
        const image = await loadImageElement(file);
        const max = 256;
        const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas');
        ctx.drawImage(image, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        setFrames(
          [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => ({
            deg,
            rgba: rotateHue(data, deg),
            width,
            height,
          })),
        );
      } catch {
        setFrames(null);
        setFileError('Could not read that image.');
      }
    })();
  };

  const shown: Frame[] = frames ?? swatches;
  const grid: JSX.Element = (
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {shown.map((frame) => (
        <VariantCanvas key={`${frame.deg}-${frame.hex ?? 'img'}`} frame={frame} />
      ))}
    </div>
  );

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Type a color, or drop an image. Each step turns the hue by 30 degrees. Images are scaled down to 256 pixels on
        the long side before the shift.
      </p>
      <FileDropZone label="Image" accept="image/*" maxBytes={25 * 1024 * 1024} onFiles={onFiles} />
      <TwoPane
        inputLabel="Color"
        input={input}
        onInput={(value) => {
          setFrames(null);
          setInput(value);
        }}
        inputPlaceholder="#ff0000"
        outputLabel="Hue steps"
        output={text.output ?? ''}
        error={fileError ?? text.error}
        examples={meta.examples}
      />
      {shown.length > 0 && grid}
    </div>
  );
}
