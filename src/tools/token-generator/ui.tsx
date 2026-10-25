import { useCallback, useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import {
  DEFAULT_BYTES,
  MAX_BYTES,
  MAX_COUNT,
  MIN_BYTES,
  parseByteLength,
  parseCount,
  tokenGenerator,
  type TokenFormat,
} from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const FORMATS = [
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' },
  { value: 'base64url', label: 'Base64url' },
] as const satisfies ReadonlyArray<{ value: TokenFormat; label: string }>;

export default function TokenGeneratorTool() {
  const [countText, setCountText] = useState('5');
  const [bytesText, setBytesText] = useState(String(DEFAULT_BYTES));
  const [format, setFormat] = useState<TokenFormat>('hex');
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const generate = useCallback(() => {
    try {
      setValues(tokenGenerator(parseCount(countText), random, parseByteLength(bytesText), format));
      setError(undefined);
    } catch (e) {
      setValues([]);
      setError(errorMessage(e));
    }
  }, [countText, bytesText, format]);

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
          class="w-28"
          data-xt="input"
        />
        <Input
          label={`Bytes each (${MIN_BYTES}–${MAX_BYTES})`}
          value={bytesText}
          onValue={setBytesText}
          inputMode="numeric"
          class="w-36"
        />
        <Select label="Encoding" value={format} options={FORMATS} onValue={setFormat} />
        <Button variant="primary" onClick={generate}>
          Generate
        </Button>
      </div>
      <p class="text-xs text-muted">Each token is drawn from crypto.getRandomValues and encoded on this device.</p>
      <OutputRegion label="Generated tokens">
        <TextArea label="Generated tokens" hideLabel value={text} readOnly rows={8} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <DownloadButton data={text} filename="tokens.txt" />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
