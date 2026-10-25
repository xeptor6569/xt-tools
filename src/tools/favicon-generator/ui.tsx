import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { describeFavicon, parseFavicon, pngsToIco, type FaviconSpec } from './logic.ts';
import { ToolInputError } from '../types.ts';

function drawLetter(ctx: CanvasRenderingContext2D, size: number, spec: FaviconSpec): void {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = spec.background;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = spec.foreground;
  ctx.font = `700 ${Math.round(size * 0.62)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.letter, size / 2, size / 2);
}

function renderPng(size: number, spec: FaviconSpec): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new ToolInputError('Canvas is not available in this browser.'));
  drawLetter(ctx, size, spec);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new ToolInputError('Could not encode the PNG.'));
        return;
      }
      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(() => reject(new ToolInputError('Could not read the PNG.')));
    }, 'image/png');
  });
}

export default function FaviconGeneratorTool() {
  const [input, setInput] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const result = useMemo(() => runTool(() => describeFavicon(input)), [input]);
  const spec = result.output ? parseFavicon(input) : undefined;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    if (!spec) {
      ctx.clearRect(0, 0, el.width, el.height);
      return;
    }
    drawLetter(ctx, el.width, spec);
  }, [spec]);

  return (
    <div class="flex flex-col gap-4">
      <TextArea
        label="Letter"
        hint="A letter, optionally followed by two #RRGGBB colours for the background and the glyph."
        value={input}
        onValue={setInput}
        rows={2}
        class="min-h-16"
        data-xt="input"
      />
      <canvas
        ref={canvas}
        width={64}
        height={64}
        role="img"
        aria-label={result.output || 'Favicon preview'}
        class="h-16 w-16 rounded-md border border-border"
      />
      <OutputRegion label="Favicon">
        <p>{result.output || 'Type a letter to draw a favicon.'}</p>
        <div class="flex flex-wrap gap-2">
          <DownloadButton
            label="Download PNG"
            filename="favicon.png"
            mime="image/png"
            data={spec ? () => renderPng(64, spec) : ''}
          />
          <DownloadButton
            label="Download ICO"
            filename="favicon.ico"
            mime="image/x-icon"
            data={
              spec
                ? async () =>
                    pngsToIco([
                      { size: 16, png: await renderPng(16, spec) },
                      { size: 32, png: await renderPng(32, spec) },
                    ])
                : ''
            }
          />
        </div>
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
