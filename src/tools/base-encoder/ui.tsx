import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { baseEncoder, ENCODINGS, type Direction, type Encoding } from './logic.ts';
import meta from './meta.ts';

const DIRECTIONS = [
  { value: 'encode', label: 'Encode text' },
  { value: 'decode', label: 'Decode to text' },
] as const satisfies ReadonlyArray<{ value: Direction; label: string }>;

export default function BaseEncoderTool() {
  const [input, setInput] = useState('');
  const [encoding, setEncoding] = useState<Encoding>('base64');
  const [direction, setDirection] = useState<Direction>('encode');
  const result = useMemo(() => runTool(() => baseEncoder(input, encoding, direction)), [input, encoding, direction]);
  const label = ENCODINGS.find((e) => e.value === encoding)?.label ?? encoding;
  const output = result.output?.text ?? '';

  return (
    <div class="flex flex-col gap-3">
      <TwoPane
        controls={
          <>
            <Select label="Encoding" value={encoding} options={ENCODINGS} onValue={setEncoding} />
            <Select label="Direction" value={direction} options={DIRECTIONS} onValue={setDirection} />
            <Button
              disabled={!result.output || output === ''}
              onClick={() => {
                setInput(output);
                setDirection(direction === 'encode' ? 'decode' : 'encode');
              }}
            >
              Swap
            </Button>
          </>
        }
        inputLabel={direction === 'encode' ? 'Text' : label}
        input={input}
        onInput={setInput}
        outputLabel={direction === 'encode' ? label : result.output?.binary ? 'Bytes (hex)' : 'Text'}
        output={output}
        error={result.error}
        examples={direction === 'encode' ? meta.examples : undefined}
      />
      {result.output?.binary && (
        <p role="status" class="text-sm text-muted">
          The decoded bytes aren’t valid UTF-8 text, so they are shown as hex.
        </p>
      )}
    </div>
  );
}
