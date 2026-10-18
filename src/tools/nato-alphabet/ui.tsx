import { useMemo, useState } from 'preact/hooks';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { natoAlphabet, type Direction } from './logic.ts';
import meta from './meta.ts';

const DIRECTIONS = [
  { value: 'auto', label: 'Detect automatically' },
  { value: 'encode', label: 'Text → NATO' },
  { value: 'decode', label: 'NATO → text' },
] as const satisfies ReadonlyArray<{ value: Direction; label: string }>;

export default function NatoAlphabetTool() {
  const [input, setInput] = useState('');
  const [direction, setDirection] = useState<Direction>('auto');
  const result = useMemo(() => runTool(() => natoAlphabet(input, direction)), [input, direction]);
  return (
    <TwoPane
      controls={<Select label="Direction" value={direction} options={DIRECTIONS} onValue={setDirection} />}
      inputLabel="Text or code words"
      input={input}
      onInput={setInput}
      outputLabel="Result"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
