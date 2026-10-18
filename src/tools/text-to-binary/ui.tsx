import { useMemo, useState } from 'preact/hooks';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { textToBinary, type ByteFormat, type Direction } from './logic.ts';
import meta from './meta.ts';

const FORMATS = [
  { value: 'binary', label: 'Binary' },
  { value: 'octal', label: 'Octal' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'hex', label: 'Hex' },
] as const satisfies ReadonlyArray<{ value: ByteFormat; label: string }>;

const DIRECTIONS = [
  { value: 'encode', label: 'Text → bytes' },
  { value: 'decode', label: 'Bytes → text' },
] as const satisfies ReadonlyArray<{ value: Direction; label: string }>;

export default function TextToBinaryTool() {
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<ByteFormat>('binary');
  const [direction, setDirection] = useState<Direction>('encode');
  const result = useMemo(() => runTool(() => textToBinary(input, format, direction)), [input, format, direction]);
  return (
    <div class="flex flex-col gap-3">
      <TwoPane
        controls={
          <>
            <Select label="Direction" value={direction} options={DIRECTIONS} onValue={setDirection} />
            <Select label="Byte format" value={format} options={FORMATS} onValue={setFormat} />
          </>
        }
        inputLabel={direction === 'encode' ? 'Text' : 'Bytes'}
        input={input}
        onInput={setInput}
        outputLabel={direction === 'encode' ? 'Bytes (UTF-8)' : result.output?.binary ? 'Bytes (hex)' : 'Text'}
        output={result.output?.text ?? ''}
        error={result.error}
        examples={direction === 'encode' ? meta.examples : undefined}
      />
      {result.output?.binary && (
        <p role="status" class="text-sm text-muted">
          These bytes aren’t valid UTF-8 text, so they are shown as hex.
        </p>
      )}
    </div>
  );
}
