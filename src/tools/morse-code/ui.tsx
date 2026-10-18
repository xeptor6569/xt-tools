import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { encode, morseCode, timings, type Direction } from './logic.ts';
import meta from './meta.ts';

const DIRECTIONS = [
  { value: 'auto', label: 'Detect automatically' },
  { value: 'encode', label: 'Text → Morse' },
  { value: 'decode', label: 'Morse → text' },
] as const satisfies ReadonlyArray<{ value: Direction; label: string }>;

/** Plays Morse with WebAudio; returns a function that stops it. */
function play(morse: string, wpm: number, frequency: number, onEnd: () => void): () => void {
  const ctx = new AudioContext();
  const unit = 1.2 / wpm;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  gain.gain.value = 0;
  osc.connect(gain).connect(ctx.destination);
  let t = ctx.currentTime + 0.05;
  for (const step of timings(morse)) {
    const d = step.units * unit;
    if (step.on) {
      // Short ramps avoid clicks.
      gain.gain.setTargetAtTime(0.5, t, 0.004);
      gain.gain.setTargetAtTime(0, t + d, 0.004);
    }
    t += d;
  }
  osc.start();
  osc.stop(t + 0.1);
  osc.onended = () => {
    void ctx.close();
    onEnd();
  };
  return () => {
    osc.onended = null;
    void ctx.close();
    onEnd();
  };
}

export default function MorseCodeTool() {
  const [input, setInput] = useState('');
  const [direction, setDirection] = useState<Direction>('auto');
  const [wpm, setWpm] = useState('20');
  const [frequency, setFrequency] = useState('600');
  const [playing, setPlaying] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const result = useMemo(() => runTool(() => morseCode(input, direction)), [input, direction]);
  const output = result.output?.text ?? '';
  const isMorse = output !== '' && /^[\s.\-/]+$/.test(output);
  const audible = isMorse ? output : input.trim() && /^[\s.\-/]+$/.test(input) ? input : encode(output).morse;

  useEffect(() => () => stop.current?.(), []);

  return (
    <div class="flex flex-col gap-3">
      <TwoPane
        controls={<Select label="Direction" value={direction} options={DIRECTIONS} onValue={setDirection} />}
        inputLabel="Text or Morse code"
        input={input}
        onInput={setInput}
        outputLabel="Result"
        output={output}
        error={result.error}
        examples={meta.examples}
      />
      {result.output && result.output.skipped.length > 0 && (
        <p role="status" class="text-sm text-warning">
          No Morse code for: {result.output.skipped.join(' ')}
        </p>
      )}
      <div class="flex flex-wrap items-end gap-4">
        <Input label="Speed (words per minute)" value={wpm} onValue={setWpm} inputMode="numeric" class="w-24" />
        <Input label="Tone (Hz)" value={frequency} onValue={setFrequency} inputMode="numeric" class="w-24" />
        <Button
          variant="primary"
          disabled={!audible}
          onClick={() => {
            if (playing) {
              stop.current?.();
              return;
            }
            const w = Math.min(60, Math.max(5, Number(wpm) || 20));
            const f = Math.min(2000, Math.max(200, Number(frequency) || 600));
            setPlaying(true);
            stop.current = play(audible, w, f, () => {
              setPlaying(false);
              stop.current = null;
            });
          }}
        >
          {playing ? 'Stop' : 'Play sound'}
        </Button>
      </div>
    </div>
  );
}
