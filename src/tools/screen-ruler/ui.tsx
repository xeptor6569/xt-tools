import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { screenRuler } from './logic.ts';
import meta from './meta.ts';

function drawRuler(canvas: HTMLCanvasElement, cssWidth: number) {
  const height = 64;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const root = getComputedStyle(document.documentElement);
  const fg = root.getPropertyValue('--color-fg').trim() || '#111827';
  const muted = root.getPropertyValue('--color-muted').trim() || '#4b5563';
  const bg = root.getPropertyValue('--color-bg').trim() || '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssWidth, height);
  ctx.strokeStyle = fg;
  ctx.fillStyle = muted;
  ctx.font = '11px sans-serif';
  ctx.beginPath();
  ctx.moveTo(0, height - 1);
  ctx.lineTo(cssWidth, height - 1);
  for (let x = 0; x <= cssWidth; x += 10) {
    const major = x % 50 === 0;
    const tick = major ? 28 : x % 20 === 0 ? 18 : 10;
    ctx.moveTo(x + 0.5, height - 1);
    ctx.lineTo(x + 0.5, height - 1 - tick);
    if (major) ctx.fillText(String(x), x + 2, 16);
  }
  ctx.stroke();
}

export default function ScreenRulerTool() {
  const [input, setInput] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const result = useMemo(() => runTool(() => screenRuler(input)), [input]);

  useEffect(() => {
    const update = () => {
      setSize({
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const box = frame.current;
    const el = canvas.current;
    if (!box || !el) return;
    const draw = () => {
      const width = box.clientWidth;
      if (width >= 1) drawRuler(el, width);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const lines = [
    `Window: ${size.w} × ${size.h} CSS px`,
    `Device pixel ratio: ${size.dpr}`,
    result.output ? `Estimated DPI: ${result.output}` : '',
  ].filter((line) => line !== '');
  const text = lines.join('\n');

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        The ruler and the window size are CSS pixels, not physical pixels. Measure a known length on screen to estimate
        DPI, for example 25.4 mm for 96 px.
      </p>
      <div ref={frame} class="rounded-lg border border-border">
        <canvas ref={canvas} class="block h-16 w-full" role="img" aria-label="CSS pixel ruler" />
      </div>
      <Input
        label="Known length"
        value={input}
        onValue={setInput}
        placeholder="25.4 mm for 96 px"
        data-xt="input"
        hint="Millimetres for a CSS-pixel length."
      />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <p data-xt="output" class="font-mono text-sm whitespace-pre-wrap">
        {text}
      </p>
      <CopyButton text={text} />
      <ErrorMessage message={result.error} />
    </div>
  );
}
