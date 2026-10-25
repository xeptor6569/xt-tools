import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import {
  displayCaptureAvailable,
  openDisplayStream,
  previewStream,
  recordUntilStopped,
  stopTracks,
} from '../../lib/media-record.ts';
import { runTool } from '../../lib/run-tool.ts';
import { extensionFor, pickVideoMime, screenRecorder } from './logic.ts';
import meta from './meta.ts';

export default function ScreenRecorderTool() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Ready. Press Start to record the screen.');
  const [problem, setProblem] = useState<string>();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<(() => void) | null>(null);
  const pending = useRef(false);
  const named = useMemo(() => runTool(() => screenRecorder(name)), [name]);

  useEffect(() => {
    setApiMissing(!displayCaptureAvailable());
    return () => session.current?.();
  }, []);

  const stop = () => session.current?.();

  const start = async () => {
    if (pending.current || session.current) return;
    pending.current = true;
    setProblem(undefined);
    setBlob(null);
    let stream: MediaStream | undefined;
    try {
      if (!displayCaptureAvailable()) {
        setApiMissing(true);
        setProblem('Screen recording is not available in this browser.');
        return;
      }
      stream = await openDisplayStream();
      const mime = pickVideoMime((type) => {
        try {
          return MediaRecorder.isTypeSupported(type);
        } catch {
          return false;
        }
      });
      const stopPreview = previewStream(stream, canvas.current);
      const live = recordUntilStopped(stream, mime, stopPreview);
      const video = stream.getVideoTracks()[0];
      const onEnded = () => live.stop();
      video?.addEventListener('ended', onEnded);
      session.current = () => {
        video?.removeEventListener('ended', onEnded);
        live.stop();
      };
      setRecording(true);
      setStatus('Recording…');
      const saved = await live.done;
      video?.removeEventListener('ended', onEnded);
      session.current = null;
      setBlob(saved);
      setRecording(false);
      setStatus(`Saved ${saved.size} bytes.`);
    } catch (error) {
      session.current?.();
      stopTracks(stream);
      session.current = null;
      setRecording(false);
      setProblem(error instanceof Error ? error.message : 'Could not start screen capture.');
    } finally {
      pending.current = false;
    }
  };

  const filename = named.output ?? 'screen.webm';
  const downloadName = blob
    ? `${filename.replace(/\.[^.]+$/, '')}.${extensionFor(blob.type || 'video/webm')}`
    : filename;

  return (
    <div class="flex flex-col gap-4">
      {apiMissing && <p class="text-sm text-muted">Recording is unavailable in this browser.</p>}
      <TwoPane
        inputLabel="Clip name"
        input={name}
        onInput={setName}
        inputPlaceholder="demo"
        outputLabel="File name"
        output={named.output ?? ''}
        error={named.error ?? problem}
        examples={meta.examples}
        controls={
          <>
            <Button variant="primary" onClick={() => void start()} disabled={recording}>
              Start
            </Button>
            <Button onClick={stop} disabled={!recording}>
              Stop
            </Button>
          </>
        }
        actions={
          blob ? (
            <DownloadButton data={blob} filename={downloadName} mime={blob.type || 'video/webm'} label="Download" />
          ) : undefined
        }
      />
      <p role="status" class="text-sm text-muted">
        {status}
      </p>
      <canvas
        ref={canvas}
        width={640}
        height={360}
        class="max-h-80 w-full rounded-lg border border-border bg-black"
        aria-label="Screen preview"
      />
    </div>
  );
}
