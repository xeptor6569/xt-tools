import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import type { VideoJobResult, VideoOutputItem, VideoOutputMode } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const MODES: ReadonlyArray<{ value: VideoOutputMode; label: string }> = [
  { value: 'gif', label: 'Animated GIF' },
  { value: 'frames', label: 'Extract PNG frames' },
];

export default function VideoToGifTool() {
  const call = useWorker(createWorker, { timeoutMs: 120_000 });
  const [input, setInput] = useState('10 320 0 3 gif');
  const [mode, setMode] = useState<VideoOutputMode>('gif');
  const [fps, setFps] = useState('10');
  const [width, setWidth] = useState('320');
  const [start, setStart] = useState('0');
  const [duration, setDuration] = useState('3');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [outputs, setOutputs] = useState<VideoOutputItem[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const syncSpec = (nextMode = mode, nextFps = fps, nextWidth = width, nextStart = start, nextDuration = duration) => {
    setInput(`${nextFps} ${nextWidth} ${nextStart} ${nextDuration} ${nextMode}`);
  };

  useEffect(() => {
    let current = true;
    setBusy(true);
    const run = async (): Promise<{ text: string; items: VideoOutputItem[] }> => {
      if (file) {
        const res = await call<VideoJobResult>('runFfmpegJob', file.bytes, input);
        return { text: `${res.summary}\n${res.command}`, items: res.outputs };
      }
      const text = await call<string>('videoToGif', input);
      return { text, items: [] };
    };

    run()
      .then(
        (res) => {
          if (!current) return;
          setOutput(res.text);
          setOutputs(res.items);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setOutputs([]);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input, file, call]);

  const handleRunTestPattern = () => {
    setBusy(true);
    setError(undefined);
    call<VideoJobResult>('runFfmpegJob', undefined, input)
      .then(
        (res) => {
          setOutput(`${res.summary}\n${res.command}`);
          setOutputs(res.outputs);
        },
        (e: unknown) => setError(errorMessage(e)),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div class="flex flex-col gap-4">
      <FileDropZone
        label="Video file (MP4, WebM, MOV, MKV)"
        accept="video/*,.mp4,.webm,.mov,.mkv"
        maxBytes={128 * 1024 * 1024}
        onFiles={(picked) => {
          const f = picked[0];
          if (!f) return;
          void f.arrayBuffer().then((buf) => setFile({ name: f.name, bytes: new Uint8Array(buf) }));
        }}
        hint="Up to 128 MB. Runs single-threaded ffmpeg.wasm locally inside a Web Worker."
      />
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="secondary" onClick={handleRunTestPattern} disabled={busy}>
          Generate sample test-pattern {mode === 'gif' ? 'GIF' : 'frames'} with ffmpeg.wasm
        </Button>
        {file && (
          <>
            <span>
              Loaded <span class="font-medium">{file.name}</span> ({file.bytes.length.toLocaleString('en')} bytes)
            </span>
            <button type="button" class="text-accent underline" onClick={() => setFile(undefined)}>
              Clear video file
            </button>
          </>
        )}
      </div>
      <TwoPane
        inputLabel="Conversion settings (fps width start duration mode)"
        inputPlaceholder="10 320 0 3 gif"
        input={input}
        onInput={setInput}
        outputLabel="FFmpeg plan & output"
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={
          <>
            <Select
              label="Output"
              value={mode}
              options={MODES}
              onValue={(v) => {
                setMode(v);
                syncSpec(v, fps, width, start, duration);
              }}
            />
            <Input
              label="FPS (1–30)"
              value={fps}
              inputMode="numeric"
              class="w-24"
              onValue={(v) => {
                setFps(v);
                if (/^\d+$/.test(v)) syncSpec(mode, v, width, start, duration);
              }}
            />
            <Input
              label="Width (px)"
              value={width}
              inputMode="numeric"
              class="w-28"
              onValue={(v) => {
                setWidth(v);
                if (/^\d+$/.test(v)) syncSpec(mode, fps, v, start, duration);
              }}
            />
            <Input
              label="Start (s)"
              value={start}
              inputMode="decimal"
              class="w-24"
              onValue={(v) => {
                setStart(v);
                if (/^\d+(\.\d+)?$/.test(v)) syncSpec(mode, fps, width, v, duration);
              }}
            />
            <Input
              label="Duration (s)"
              value={duration}
              inputMode="decimal"
              class="w-28"
              onValue={(v) => {
                setDuration(v);
                if (/^\d+(\.\d+)?$/.test(v)) syncSpec(mode, fps, width, start, v);
              }}
            />
          </>
        }
      />
      {outputs.length > 0 && (
        <section aria-label="Generated files" class="grid gap-3 sm:grid-cols-2">
          {outputs.map((item) => (
            <div
              key={item.filename}
              class="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <div>
                <div class="font-medium">{item.filename}</div>
                <div class="text-xs text-muted">{item.bytes.length.toLocaleString('en')} bytes</div>
              </div>
              <DownloadButton data={item.bytes} filename={item.filename} mime={item.mime} label="Download" />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
