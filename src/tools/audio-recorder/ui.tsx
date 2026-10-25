import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { openMicrophoneStream, recordUntilStopped, stopTracks, userCaptureAvailable } from '../../lib/media-record.ts';
import { runTool } from '../../lib/run-tool.ts';
import { audioRecorder, extensionFor, pickAudioMime, waveformBars } from './logic.ts';
import meta from './meta.ts';

function watchWaveform(stream: MediaStream, canvas: HTMLCanvasElement | null): () => void {
  if (!canvas || typeof AudioContext === 'undefined') return () => {};
  const audio = new AudioContext();
  const source = audio.createMediaStreamSource(stream);
  const analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  void audio.resume().catch(() => {});
  const samples = new Uint8Array(analyser.fftSize);
  let frame = 0;
  const draw = () => {
    analyser.getByteTimeDomainData(samples);
    const bars = waveformBars(samples, 64);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const width = canvas.width;
      const height = canvas.height;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#38bdf8';
      const barWidth = width / bars.length;
      for (let i = 0; i < bars.length; i++) {
        const barHeight = Math.max(2, ((bars[i] ?? 0) / 100) * height);
        ctx.fillRect(i * barWidth + 1, (height - barHeight) / 2, Math.max(1, barWidth - 2), barHeight);
      }
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    source.disconnect();
    void audio.close().catch(() => {});
  };
}

export default function AudioRecorderTool() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Ready. Press Start to record.');
  const [problem, setProblem] = useState<string>();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<(() => void) | null>(null);
  const pending = useRef(false);
  const named = useMemo(() => runTool(() => audioRecorder(name)), [name]);

  useEffect(() => {
    setApiMissing(!userCaptureAvailable());
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
      if (!userCaptureAvailable()) {
        setApiMissing(true);
        setProblem('Microphone recording is not available in this browser.');
        return;
      }
      stream = await openMicrophoneStream();
      const mime = pickAudioMime((type) => {
        try {
          return MediaRecorder.isTypeSupported(type);
        } catch {
          return false;
        }
      });
      const stopWave = watchWaveform(stream, canvas.current);
      const live = recordUntilStopped(stream, mime, stopWave);
      session.current = () => live.stop();
      setRecording(true);
      setStatus('Recording…');
      const saved = await live.done;
      session.current = null;
      setBlob(saved);
      setRecording(false);
      setStatus(`Saved ${saved.size} bytes.`);
    } catch (error) {
      session.current?.();
      stopTracks(stream);
      session.current = null;
      setRecording(false);
      setProblem(error instanceof Error ? error.message : 'Could not start the microphone.');
    } finally {
      pending.current = false;
    }
  };

  const filename = named.output ?? 'audio.webm';
  const downloadName = blob
    ? `${filename.replace(/\.[^.]+$/, '')}.${extensionFor(blob.type || 'audio/webm')}`
    : filename;

  return (
    <div class="flex flex-col gap-4">
      {apiMissing && <p class="text-sm text-muted">Recording is unavailable in this browser.</p>}
      <TwoPane
        inputLabel="Clip name"
        input={name}
        onInput={setName}
        inputPlaceholder="voice"
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
            <DownloadButton data={blob} filename={downloadName} mime={blob.type || 'audio/webm'} label="Download" />
          ) : undefined
        }
      />
      <p role="status" class="text-sm text-muted">
        {status}
      </p>
      <canvas
        ref={canvas}
        width={640}
        height={160}
        class="w-full max-w-xl rounded-lg border border-border"
        aria-label="Microphone waveform"
      />
    </div>
  );
}
