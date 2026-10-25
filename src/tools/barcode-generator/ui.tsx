import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { downloadBlob } from '../../lib/download.ts';
import { runTool } from '../../lib/run-tool.ts';
import { barcodeGenerator, encodeBarcode, type Barcode } from './logic.ts';
import meta from './meta.ts';

function drawBarcode(canvas: HTMLCanvasElement, code: Barcode) {
  const scale = 2;
  const quiet = 10;
  const barHeight = 90;
  const width = (code.bits.length + quiet * 2) * scale;
  canvas.width = width;
  canvas.height = barHeight + 28;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  for (let i = 0; i < code.bits.length; i++) {
    if (code.bits[i] === '1') ctx.fillRect((quiet + i) * scale, 0, scale, barHeight);
  }
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(code.label, width / 2, barHeight + 20);
}

export default function BarcodeGeneratorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => barcodeGenerator(input)), [input]);
  const code = useMemo(() => runTool(() => encodeBarcode(input)).output, [input]);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvas.current && code) drawBarcode(canvas.current, code);
  }, [code]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        EAN-13: ean 590123412345 (the check digit is added). Anything else is Code 128 set B. Prefix code128 to force
        that.
      </p>
      <TwoPane
        inputLabel="Barcode"
        input={input}
        onInput={setInput}
        inputPlaceholder="ean 590123412345"
        outputLabel="Code"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
      {code && (
        <canvas
          ref={canvas}
          role="img"
          aria-label={code.label}
          class="h-auto max-w-full rounded-lg border border-border bg-white"
        />
      )}
      {code && (
        <Button
          onClick={() => {
            const el = canvas.current;
            if (!el) return;
            el.toBlob((blob) => {
              if (blob) downloadBlob(blob, 'barcode.png');
            }, 'image/png');
          }}
        >
          Download PNG
        </Button>
      )}
    </div>
  );
}
