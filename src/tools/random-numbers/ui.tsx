import { useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { parseBound, parseCount, parseSeed, randomIntegers, rollDice, seedFromBytes, shuffleLines } from './logic.ts';

type Mode = 'integers' | 'dice' | 'shuffle';

const MODES = [
  { value: 'integers', label: 'Integers' },
  { value: 'dice', label: 'Dice' },
  { value: 'shuffle', label: 'Shuffle lines' },
] as const satisfies ReadonlyArray<{ value: Mode; label: string }>;

export default function RandomNumbersTool() {
  const [mode, setMode] = useState<Mode>('integers');
  const [countText, setCountText] = useState('5');
  const [minText, setMinText] = useState('1');
  const [maxText, setMaxText] = useState('100');
  const [diceText, setDiceText] = useState('2d6');
  const [lines, setLines] = useState('red\ngreen\nblue');
  const [seedText, setSeedText] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [roll, setRoll] = useState(0);

  useEffect(() => {
    try {
      const parsed = parseSeed(seedText);
      const seed = parsed ?? seedFromBytes(crypto.getRandomValues(new Uint8Array(16)));
      const count = parseCount(countText);
      let text = '';
      if (mode === 'integers') {
        text = randomIntegers(count, parseBound(minText, 'Min'), parseBound(maxText, 'Max'), seed).join('\n');
      } else if (mode === 'dice') {
        text = rollDice(diceText, count, seed).join('\n');
      } else {
        text = shuffleLines(lines, seed);
      }
      setOutput(text);
      setError(undefined);
    } catch (e) {
      setOutput('');
      setError(errorMessage(e));
    }
  }, [mode, countText, minText, maxText, diceText, lines, seedText, roll]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Leave the seed empty for a fresh cryptographic draw. A whole-number seed uses mulberry32, so the same seed
        repeats the same result.
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <Select label="Mode" value={mode} options={MODES} onValue={setMode} />
        <Input label="Seed" value={seedText} onValue={setSeedText} inputMode="numeric" class="w-36" data-xt="input" />
        {mode !== 'shuffle' && (
          <Input label="Count" value={countText} onValue={setCountText} inputMode="numeric" class="w-28" />
        )}
        {mode === 'integers' && (
          <>
            <Input label="Min" value={minText} onValue={setMinText} inputMode="numeric" class="w-28" />
            <Input label="Max" value={maxText} onValue={setMaxText} inputMode="numeric" class="w-28" />
          </>
        )}
        {mode === 'dice' && (
          <Input label="Dice" value={diceText} onValue={setDiceText} placeholder="2d6" class="w-28" />
        )}
        <Button variant="primary" onClick={() => setRoll((n) => n + 1)}>
          Generate
        </Button>
      </div>
      {mode === 'shuffle' && <TextArea label="Lines to shuffle" value={lines} onValue={setLines} rows={6} />}
      <p data-xt="output" class="min-h-24 font-mono text-sm whitespace-pre-wrap">
        {output}
      </p>
      <div class="flex flex-wrap gap-2">
        <CopyButton text={output} />
      </div>
      <ErrorMessage message={error} />
    </div>
  );
}
