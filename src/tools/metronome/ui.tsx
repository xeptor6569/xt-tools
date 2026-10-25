import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { beatIntervalMs, parseBpm } from './logic.ts';

export default function MetronomeTool() {
  const [bpmText, setBpmText] = useState('120');
  const [bpm, setBpm] = useState(120);
  const [running, setRunning] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [error, setError] = useState<string>();

  const onBpm = (text: string) => {
    setBpmText(text);
    try {
      setBpm(parseBpm(text));
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  useEffect(() => {
    if (!running) return;
    if (typeof AudioContext === 'undefined') {
      setError('This browser has no WebAudio support.');
      setRunning(false);
      return;
    }
    const ctx = new AudioContext();
    const interval = beatIntervalMs(bpm) / 1000;
    let next = 0;
    let timer = 0;
    const click = (time: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.25, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.05);
    };
    const pump = () => {
      const horizon = ctx.currentTime + 0.25;
      while (next < horizon) {
        click(next);
        if (next - ctx.currentTime < 0.06) setPulse((on) => !on);
        next += interval;
      }
    };
    void ctx.resume().then(() => {
      next = ctx.currentTime + 0.05;
      pump();
      timer = window.setInterval(pump, 50);
    });
    return () => {
      window.clearInterval(timer);
      void ctx.close();
    };
  }, [running, bpm]);

  const start = () => {
    try {
      setBpm(parseBpm(bpmText));
      setError(undefined);
      setRunning(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">Press start to click. The tone uses WebAudio and does not play on load.</p>
      <div class="flex flex-wrap items-end gap-3">
        <Input label="BPM" value={bpmText} onValue={onBpm} inputMode="decimal" class="w-32" data-xt="input" />
        <Button variant="primary" onClick={() => (running ? setRunning(false) : start())}>
          {running ? 'Stop' : 'Start'}
        </Button>
        <span
          class={
            pulse
              ? 'mb-2 inline-block h-3 w-3 rounded-full bg-accent'
              : 'mb-2 inline-block h-3 w-3 rounded-full bg-border'
          }
          aria-hidden="true"
        />
      </div>
      <p data-xt="output" class="font-mono text-lg">
        {bpm} BPM · {running ? 'running' : 'stopped'}
      </p>
      <ErrorMessage message={error} />
    </div>
  );
}
