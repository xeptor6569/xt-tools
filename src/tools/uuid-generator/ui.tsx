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
import { MAX_COUNT, parseCount, uuidGenerator, type UuidVersion } from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const VERSIONS = [
  { value: 'v4', label: 'Version 4 (random)' },
  { value: 'v7', label: 'Version 7 (time-ordered)' },
  { value: 'nil', label: 'Nil (all zeros)' },
  { value: 'max', label: 'Max (all ones)' },
] as const satisfies ReadonlyArray<{ value: UuidVersion; label: string }>;

export default function UuidGeneratorTool() {
  const [countText, setCountText] = useState('5');
  const [version, setVersion] = useState<UuidVersion>('v4');
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const generate = useCallback(() => {
    try {
      setValues(uuidGenerator(parseCount(countText), { version, uppercase, hyphens, braces }, random));
      setError(undefined);
    } catch (e) {
      setValues([]);
      setError(errorMessage(e));
    }
  }, [countText, version, uppercase, hyphens, braces]);

  // Generate on the client only, so nothing random is baked into the HTML.
  useEffect(generate, [generate]);

  const text = values.join('\n');
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <Select label="Version" value={version} options={VERSIONS} onValue={setVersion} />
        <Input
          label={`How many (1–${MAX_COUNT})`}
          value={countText}
          onValue={setCountText}
          inputMode="numeric"
          class="w-28"
          data-xt="input"
        />
        <Button variant="primary" onClick={generate}>
          Generate
        </Button>
      </div>
      <div class="flex flex-wrap gap-x-6">
        <Toggle label="Upper case" checked={uppercase} onChecked={setUppercase} />
        <Toggle label="Hyphens" checked={hyphens} onChecked={setHyphens} />
        <Toggle label="Braces" checked={braces} onChecked={setBraces} />
      </div>
      <OutputRegion label="Generated UUIDs">
        <TextArea label="Generated UUIDs" hideLabel value={text} readOnly rows={8} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <DownloadButton data={text} filename="uuids.txt" />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
