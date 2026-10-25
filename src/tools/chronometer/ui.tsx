import { useEffect, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import { formatElapsed, formatLaps } from './logic.ts';

export default function ChronometerTool() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const base = useRef(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const start = startedAt.current ?? performance.now();
      setElapsed(base.current + (performance.now() - start));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const current = () => {
    if (!running || startedAt.current === null) return base.current;
    return base.current + (performance.now() - startedAt.current);
  };

  const start = () => {
    if (running) return;
    startedAt.current = performance.now();
    setRunning(true);
  };

  const stop = () => {
    if (!running) return;
    base.current = current();
    startedAt.current = null;
    setElapsed(base.current);
    setRunning(false);
  };

  const lap = () => {
    if (!running) return;
    const total = current();
    setLaps((items) => [...items, total]);
  };

  const reset = () => {
    base.current = 0;
    startedAt.current = null;
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  };

  const elapsedText = formatElapsed(elapsed);
  const lapText = formatLaps(laps);
  const copyText = lapText ? `${elapsedText}\n${lapText}` : elapsedText;

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">Press start to time an interval. This does not start on its own.</p>
      <p data-xt="output" class="font-mono text-4xl tabular-nums" aria-live="off">
        {elapsedText}
      </p>
      <div class="flex flex-wrap gap-2">
        <Button variant="primary" onClick={start} disabled={running}>
          Start
        </Button>
        <Button onClick={stop} disabled={!running}>
          Stop
        </Button>
        <Button onClick={lap} disabled={!running}>
          Lap
        </Button>
        <Button onClick={reset}>Reset</Button>
        <CopyButton text={copyText} />
      </div>
      {lapText && <pre class="font-mono text-sm whitespace-pre-wrap">{lapText}</pre>}
    </div>
  );
}
