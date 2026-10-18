import { useCallback, useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { loremIpsum, MAX_COUNT, parseCount, type Unit } from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const UNITS = [
  { value: 'paragraphs', label: 'Paragraphs' },
  { value: 'sentences', label: 'Sentences' },
  { value: 'words', label: 'Words' },
] as const satisfies ReadonlyArray<{ value: Unit; label: string }>;

export default function LoremIpsumTool() {
  const [countText, setCountText] = useState('3');
  const [unit, setUnit] = useState<Unit>('paragraphs');
  const [lorem, setLorem] = useState(true);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  const generate = useCallback(() => {
    try {
      setText(loremIpsum(parseCount(countText), unit, random, lorem));
      setError(undefined);
    } catch (e) {
      setText('');
      setError(errorMessage(e));
    }
  }, [countText, unit, lorem]);

  useEffect(generate, [generate]);

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <Input
          label={`How many (1–${MAX_COUNT})`}
          value={countText}
          onValue={setCountText}
          inputMode="numeric"
          class="w-28"
          data-xt="input"
        />
        <Select label="Of" value={unit} options={UNITS} onValue={setUnit} />
        <Toggle label='Start with "Lorem ipsum"' checked={lorem} onChecked={setLorem} />
        <Button variant="primary" onClick={generate}>
          Generate
        </Button>
      </div>
      <OutputRegion label="Placeholder text">
        <TextArea label="Placeholder text" hideLabel value={text} readOnly rows={12} />
        <div>
          <CopyButton text={text} />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
