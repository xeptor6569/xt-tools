import { useCallback, useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { ipv6Ula, MAX_COUNT, parseCount } from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export default function Ipv6UlaTool() {
  const [countText, setCountText] = useState('5');
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const generate = useCallback(() => {
    try {
      setValues(ipv6Ula(parseCount(countText), random));
      setError(undefined);
    } catch (e) {
      setValues([]);
      setError(errorMessage(e));
    }
  }, [countText]);

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
          data-xt="input"
        />
        <Button variant="primary" onClick={generate}>
          Generate
        </Button>
      </div>
      <OutputRegion label="ULA prefixes">
        <p class="text-sm text-muted">
          Each value is an RFC 4193 prefix: fd00::/8 with 40 random bits, written as a /48.
        </p>
        <TextArea label="ULA prefixes" hideLabel value={text} readOnly rows={8} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <DownloadButton data={text} filename="ipv6-ula.txt" />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
