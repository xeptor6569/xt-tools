import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { formatNumber } from '../../lib/safe-expr.ts';
import { runTool } from '../../lib/run-tool.ts';
import { plotFunction, type PlotPoint } from './logic.ts';
import meta from './meta.ts';

function yLimits(samples: PlotPoint[]): { min: number; max: number } | undefined {
  const ys = samples
    .map((point) => point.y)
    .filter((y): y is number => y !== null && Number.isFinite(y))
    .sort((a, b) => a - b);
  if (ys.length === 0) return undefined;
  const lo = ys[Math.floor((ys.length - 1) * 0.02)]!;
  const hi = ys[Math.ceil((ys.length - 1) * 0.98)]!;
  let min = lo;
  let max = hi;
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

function paint(canvas: HTMLCanvasElement, samples: PlotPoint[]) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW < 10 || cssH < 10) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const root = getComputedStyle(document.documentElement);
  const fg = root.getPropertyValue('--color-fg').trim() || '#111827';
  const muted = root.getPropertyValue('--color-muted').trim() || '#4b5563';
  const border = root.getPropertyValue('--color-border').trim() || '#d1d5db';
  const accent = root.getPropertyValue('--color-accent').trim() || '#1d4ed8';
  const bg = root.getPropertyValue('--color-bg').trim() || '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);
  const limits = yLimits(samples);
  if (!limits) return;
  const xMin = -10;
  const xMax = 10;
  const padL = 52;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;
  const xOf = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * w;
  const yOf = (y: number) => padT + ((limits.max - y) / (limits.max - limits.min)) * h;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.fillStyle = muted;
  ctx.font = '11px sans-serif';
  for (let x = -10; x <= 10; x += 2) {
    ctx.beginPath();
    ctx.moveTo(xOf(x), padT);
    ctx.lineTo(xOf(x), padT + h);
    ctx.stroke();
    ctx.fillText(String(x), xOf(x) - 8, padT + h + 16);
  }
  for (let i = 0; i <= 4; i++) {
    const y = limits.min + ((limits.max - limits.min) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, yOf(y));
    ctx.lineTo(padL + w, yOf(y));
    ctx.stroke();
    ctx.fillText(formatNumber(y), 4, yOf(y) + 4);
  }
  ctx.strokeStyle = fg;
  ctx.beginPath();
  if (limits.min <= 0 && limits.max >= 0) {
    ctx.moveTo(padL, yOf(0));
    ctx.lineTo(padL + w, yOf(0));
  }
  ctx.moveTo(xOf(0), padT);
  ctx.lineTo(xOf(0), padT + h);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, w, h);
  ctx.clip();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let drawing = false;
  for (const point of samples) {
    if (point.y === null) {
      drawing = false;
      continue;
    }
    const px = xOf(point.x);
    const py = yOf(point.y);
    if (!drawing) {
      ctx.moveTo(px, py);
      drawing = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export default function GraphPlotterTool() {
  const [input, setInput] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const result = useMemo(() => runTool(() => plotFunction(input)), [input]);
  const text = result.output?.text ?? '';
  const samples = result.output?.samples;

  useEffect(() => {
    const el = canvas.current;
    const frame = box.current;
    if (!el || !frame) return;
    const draw = () => paint(el, samples ?? []);
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [samples]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Plot y as a function of x from −10 to 10. Trigonometry uses degrees. The sample points are also listed as text.
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <TextArea label="Expression" value={input} onValue={setInput} placeholder="x" data-xt="input" />
          <ExampleButton examples={meta.examples} onPick={setInput} />
        </div>
        <div class="flex flex-col gap-2">
          <div ref={box} class="h-80 w-full rounded-lg border border-border bg-bg">
            <canvas ref={canvas} class="h-full w-full" role="img" aria-label="Plot of y for x from -10 to 10" />
          </div>
          <TextArea label="Sample points" value={text} readOnly rows={6} data-xt="output" />
          <CopyButton text={text} />
          <ErrorMessage message={result.error} />
        </div>
      </div>
    </div>
  );
}
