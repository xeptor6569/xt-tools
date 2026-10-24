import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { useWorker } from '../../components/ui/useWorker.ts';
import { downloadBlob } from '../../lib/download.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { isToolInputError } from '../types.ts';
import { findLanguage, LANGUAGES, type LanguageId } from './languages.ts';
import {
  codeFont,
  fitScale,
  layoutCode,
  MAX_TITLE,
  tokensToLines,
  validateCode,
  type DrawOp,
  type Layout,
  type LayoutOptions,
  type Line,
} from './logic.ts';
import { BACKGROUNDS, THEMES, type BackgroundId, type Fill, type ThemeId } from './themes.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const TIMEOUT_MS = 4000;

const DEFAULT_CODE = [
  '// Greet everyone on the list',
  'function greet(names: string[]): string {',
  '  return names.map((name) => `Hello, ${name}!`).join("\\n");',
  '}',
  '',
  "console.log(greet(['Ada', 'Linus']));",
].join('\n');

const options = (values: readonly string[], suffix = '') => values.map((v) => ({ value: v, label: `${v}${suffix}` }));
const FONT_SIZES = options(['12', '13', '14', '16', '18', '20', '24'], ' px');
const LINE_HEIGHTS = options(['1.3', '1.4', '1.5', '1.6', '1.8', '2']);
const PADDINGS = options(['0', '16', '32', '48', '64', '96', '128'], ' px');
const TAB_SIZES = options(['2', '4', '8'], ' spaces');
const SCALES = [
  { value: '1', label: '1×' },
  { value: '2', label: '2× (sharp)' },
  { value: '3', label: '3×' },
];
const MAX_WIDTHS = options(['800', '1200', '1600', '2400', '4096'], ' px');

type Highlighted = { key: string; lines: Line[]; plain: boolean };

function canvasFill(ctx: CanvasRenderingContext2D, fill: Fill, x: number, y: number, w: number, h: number) {
  if (fill.type === 'solid') return fill.color;
  const angle = (fill.angle * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gradient = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  for (const [offset, color] of fill.stops) gradient.addColorStop(offset, color);
  return gradient;
}

function draw(ctx: CanvasRenderingContext2D, ops: readonly DrawOp[], scale: number) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = 'middle';
  for (const op of ops) {
    if (op.kind === 'fill') {
      ctx.save();
      if (op.shadow) {
        // Shadows ignore the transform, so scale them by hand.
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 32 * scale;
        ctx.shadowOffsetY = 10 * scale;
      }
      ctx.fillStyle = canvasFill(ctx, op.fill, op.x, op.y, op.w, op.h);
      ctx.beginPath();
      if (op.radius > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(op.x, op.y, op.w, op.h, op.radius);
      else ctx.rect(op.x, op.y, op.w, op.h);
      ctx.fill();
      ctx.restore();
    } else if (op.kind === 'circle') {
      ctx.fillStyle = op.color;
      ctx.beginPath();
      ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (op.kind === 'text') {
      ctx.font = op.font;
      ctx.fillStyle = op.color;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    } else if (op.kind === 'clip') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(op.x, op.y, op.w, op.h);
      ctx.clip();
    } else {
      ctx.restore();
    }
  }
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode the PNG.'))),
      'image/png',
    ),
  );
}

function fileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'code'}.png`;
}

export default function CodeToImageTool() {
  const call = useWorker(createWorker, { timeoutMs: TIMEOUT_MS });
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState<LanguageId>('typescript');
  const [theme, setTheme] = useState<ThemeId>('midnight');
  const [background, setBackground] = useState<BackgroundId>('ocean');
  const [fontSize, setFontSize] = useState('14');
  const [lineHeight, setLineHeight] = useState('1.5');
  const [padding, setPadding] = useState('48');
  const [tabSize, setTabSize] = useState('2');
  const [scale, setScale] = useState('2');
  const [maxWidth, setMaxWidth] = useState('1600');
  const [lineNumbers, setLineNumbers] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [title, setTitle] = useState('');
  const [highlighted, setHighlighted] = useState<Highlighted>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [canCopy, setCanCopy] = useState(false);
  const [status, setStatus] = useState('');
  const [drawn, setDrawn] = useState<{ layout: Layout; scale: number }>();
  const canvas = useRef<HTMLCanvasElement>(null);

  const request = useMemo(() => ({ code, language, tab: Number(tabSize) }), [code, language, tabSize]);
  const args = useDebounced(request, 150);

  useEffect(() => {
    setCanCopy(window.isSecureContext && 'ClipboardItem' in window && typeof navigator.clipboard?.write === 'function');
  }, []);

  useEffect(() => {
    let current = true;
    const key = `${args.language}\u0000${args.tab}\u0000${args.code}`;
    try {
      validateCode(args.code);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      return;
    }
    setBusy(true);
    call<Line[]>('highlight', args.code, args.language, args.tab)
      .then(
        (lines) => {
          if (!current) return;
          setHighlighted({ key, lines, plain: false });
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          if (isToolInputError(e) && /^Stopped after/.test(e.message)) {
            // Highlighting took too long: show the code without colours.
            setHighlighted({ key, lines: tokensToLines(args.code, args.tab), plain: true });
            setError(undefined);
          } else {
            setError(errorMessage(e));
          }
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [args, call]);

  const layoutOptions: LayoutOptions = useMemo(
    () => ({
      theme,
      background,
      fontSize: Number(fontSize),
      lineHeight: Number(lineHeight),
      padding: Number(padding),
      lineNumbers,
      chrome,
      title,
      maxWidth: Number(maxWidth),
    }),
    [theme, background, fontSize, lineHeight, padding, lineNumbers, chrome, title, maxWidth],
  );

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || !highlighted) return;
    ctx.font = codeFont(layoutOptions.fontSize);
    const layout = layoutCode(highlighted.lines, layoutOptions, (text) => ctx.measureText(text).width);
    const s = fitScale(layout.width, layout.height, Number(scale));
    el.width = Math.round(layout.width * s);
    el.height = Math.round(layout.height * s);
    el.style.setProperty('--cw', `${layout.width}px`);
    draw(ctx, layout.ops, s);
    setDrawn({ layout, scale: s });
  }, [highlighted, layoutOptions, scale]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const download = async () => {
    if (!canvas.current) return;
    try {
      downloadBlob(await toPng(canvas.current), fileName(title));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const copyImage = async () => {
    if (!canvas.current) return;
    try {
      // Pass the promise straight to ClipboardItem: Safari requires it within the click.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPng(canvas.current) })]);
      setStatus('Image copied to the clipboard.');
    } catch {
      setStatus('Copying the image failed. Use Download PNG instead.');
    }
  };

  const langLabel = findLanguage(language).label;
  const lineCount = highlighted?.lines.length ?? 0;
  const ready = highlighted !== undefined;
  const requestedScale = Number(scale);

  return (
    <div class="flex flex-col gap-4">
      <TextArea
        label="Code"
        value={code}
        onValue={setCode}
        rows={10}
        class="min-h-48"
        hint="Up to 500 lines or 50,000 characters."
        data-xt="input"
      />
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Select
          label="Language"
          value={language}
          options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
          onValue={setLanguage}
        />
        <Select
          label="Theme"
          value={theme}
          options={THEMES.map((t) => ({ value: t.id, label: t.label }))}
          onValue={setTheme}
        />
        <Select
          label="Background"
          value={background}
          options={BACKGROUNDS.map((b) => ({ value: b.id, label: b.label }))}
          onValue={setBackground}
        />
        <Select label="Padding" value={padding} options={PADDINGS} onValue={setPadding} />
        <Select label="Font size" value={fontSize} options={FONT_SIZES} onValue={setFontSize} />
        <Select label="Line height" value={lineHeight} options={LINE_HEIGHTS} onValue={setLineHeight} />
        <Select label="Tab width" value={tabSize} options={TAB_SIZES} onValue={setTabSize} />
        <Select label="Maximum width" value={maxWidth} options={MAX_WIDTHS} onValue={setMaxWidth} />
        <Select label="Export scale" value={scale} options={SCALES} onValue={setScale} />
      </div>
      <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Toggle label="Line numbers" checked={lineNumbers} onChecked={setLineNumbers} />
        <Toggle label="Window bar" checked={chrome} onChecked={setChrome} />
        {chrome && (
          <Input
            label="Window title"
            value={title}
            onValue={setTitle}
            maxLength={MAX_TITLE}
            placeholder="e.g. greet.ts"
          />
        )}
      </div>
      <OutputRegion label="Image preview" busy={busy}>
        {!ready && !error && <LoadingState label="Loading the syntax highlighter…" />}
        <div class={ready ? 'overflow-auto rounded-lg border border-border bg-surface p-2' : 'hidden'}>
          <canvas
            ref={canvas}
            role="img"
            aria-label={`${langLabel} code image, ${lineCount} line${lineCount === 1 ? '' : 's'}`}
            class="block h-auto w-(--cw) max-w-full"
            data-xt="canvas"
          />
        </div>
        {drawn && (
          <p class="text-xs text-muted" data-xt="image-size">
            {Math.round(drawn.layout.width * drawn.scale)} × {Math.round(drawn.layout.height * drawn.scale)} px
            {drawn.scale < requestedScale ? ` (scale reduced to ${drawn.scale.toFixed(2)}× to fit browser limits)` : ''}
          </p>
        )}
        {highlighted?.plain && (
          <p role="status" class="rounded-lg bg-warning-bg p-3 text-sm text-warning">
            Highlighting this snippet took too long, so it is shown without colours.
          </p>
        )}
        {drawn?.layout.clipped && (
          <p class="text-sm text-muted">Some lines are wider than the maximum width and are cut off at the edge.</p>
        )}
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={!ready} onClick={() => void download()} data-xt="download">
            Download PNG
          </Button>
          {canCopy && (
            <Button disabled={!ready} onClick={() => void copyImage()}>
              Copy image
            </Button>
          )}
          <span role="status" class="text-sm text-muted">
            {status}
          </span>
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
      <p class="text-xs text-muted">
        Highlighting by Prism (MIT). The image is drawn in your browser with your system’s monospace font; the code
        never leaves this page.
      </p>
    </div>
  );
}
