import { useEffect, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { formatCountdown, parseMinutes, POMODORO_MINUTES } from './logic.ts';

export default function TimerTool() {
  const [minutesText, setMinutesText] = useState(String(POMODORO_MINUTES));
  const [remainingMs, setRemainingMs] = useState(POMODORO_MINUTES * 60_000);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const remainingRef = useRef(remainingMs);
  const audio = useRef<AudioContext | null>(null);
  remainingRef.current = remainingMs;

  useEffect(() => {
    if (!running) return;
    const end = performance.now() + remainingRef.current;
    let frame = 0;
    const tick = () => {
      const left = end - performance.now();
      if (left <= 0) {
        setRemainingMs(0);
        setRunning(false);
        chime(audio.current);
        return;
      }
      setRemainingMs(left);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );

  const onMinutes = (text: string) => {
    setMinutesText(text);
    if (running) return;
    try {
      setRemainingMs(parseMinutes(text) * 60_000);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const start = () => {
    try {
      const minutes = parseMinutes(minutesText);
      const ms = remainingRef.current <= 0 ? minutes * 60_000 : remainingRef.current;
      remainingRef.current = ms;
      setRemainingMs(ms);
      setError(undefined);
      if (typeof AudioContext !== 'undefined') {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      }
      setRunning(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const pause = () => setRunning(false);

  const reset = () => {
    setRunning(false);
    try {
      const ms = parseMinutes(minutesText) * 60_000;
      remainingRef.current = ms;
      setRemainingMs(ms);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">Set the minutes, then press start. Nothing runs until you do.</p>
      <div class="flex flex-wrap items-end gap-3">
        <Input
          label="Minutes"
          value={minutesText}
          onValue={onMinutes}
          inputMode="decimal"
          class="w-32"
          data-xt="input"
          disabled={running}
        />
        <Button onClick={() => onMinutes(String(POMODORO_MINUTES))} disabled={running}>
          Pomodoro 25
        </Button>
      </div>
      <p data-xt="output" class="font-mono text-5xl tabular-nums" aria-live="off">
        {formatCountdown(remainingMs)}
      </p>
      <p class="text-sm text-muted">{running ? 'Running' : 'Stopped'}</p>
      <div class="flex flex-wrap gap-2">
        <Button variant="primary" onClick={start} disabled={running}>
          Start
        </Button>
        <Button onClick={pause} disabled={!running}>
          Pause
        </Button>
        <Button onClick={reset}>Reset</Button>
      </div>
      <ErrorMessage message={error} />
    </div>
  );
}

function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}
