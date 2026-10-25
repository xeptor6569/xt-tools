import { useCallback, useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { macGenerator, MAX_COUNT, parseCount } from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export default function MacGeneratorTool() {
  const [countText, setCountText] = useState('5');
  const [local, setLocal] = useState(true);
  const [unicast, setUnicast] = useState(true);
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const generate = useCallback(() => {
    try {
      setValues(macGenerator(parseCount(countText), random, { local, unicast }));
      setError(undefined);
    } catch (e) {
      setValues([]);
      setError(errorMessage(e));
    }
  }, [countText, local, unicast]);

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
      <div class="flex flex-wrap gap-x-6">
        <Toggle
          label="Locally administered"
          checked={local}
          onChecked={setLocal}
          hint="Not a factory-assigned address."
        />
        <Toggle
          label="Unicast"
          checked={unicast}
          onChecked={setUnicast}
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
