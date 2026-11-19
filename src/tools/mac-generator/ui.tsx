import { useCallback, useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { macGenerator, MAX_COUNT, parseCount, type MacCase } from './logic.ts';

const CASES = [
  { value: 'upper', label: 'Upper case (AA:BB)' },
  { value: 'lower', label: 'Lower case (aa:bb)' },
] as const satisfies ReadonlyArray<{ value: MacCase; label: string }>;

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export default function MacGeneratorTool() {
  const [countText, setCountText] = useState('5');
  const [local, setLocal] = useState(true);
  const [unicast, setUnicast] = useState(true);
  const [prefix, setPrefix] = useState('');
  const [letterCase, setLetterCase] = useState<MacCase>('upper');
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const generate = useCallback(() => {
    try {
      setValues(macGenerator(parseCount(countText), random, { local, unicast, prefix, letterCase }));
      setError(undefined);
    } catch (e) {
      setValues([]);
      setError(errorMessage(e));
    }
  }, [countText, local, unicast, prefix, letterCase]);

  // Generate on the client only, so nothing random is baked into the HTML.
  useEffect(generate, [generate]);

  const text = values.join('\n');
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-3">
        <Input
          label={`How many (1–${MAX_COUNT})`}
          value={countText}
          onValue={setCountText}
          inputMode="numeric"
          class="w-36"
          data-xt="input"
        />
        <Button variant="primary" onClick={generate}>
          Generate
        </Button>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <Input
          label="Prefix"
          value={prefix}
          onValue={setPrefix}
          placeholder="AA:BB:CC"
          hint="Optional, up to 5 hex bytes. Copied as written, so the switches below apply only when this is empty."
          class="w-48 font-mono"
        />
        <Select label="Letter case" value={letterCase} options={CASES} onValue={setLetterCase} />
      </div>
      <div class="flex flex-wrap gap-x-6">
        <Toggle
          label="Locally administered"
          checked={local}
          onChecked={setLocal}
          disabled={prefix.trim() !== ''}
          hint="Not a factory-assigned address."
        />
        <Toggle
          label="Unicast"
          checked={unicast}
          onChecked={setUnicast}
          disabled={prefix.trim() !== ''}
          hint="A single station, not a group address."
        />
      </div>
      <OutputRegion label="MAC addresses">
        <TextArea label="MAC addresses" hideLabel value={text} readOnly rows={8} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <DownloadButton data={text} filename="mac-addresses.txt" />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
