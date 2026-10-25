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
  encodeRandom,
  opensslCommand,
  parseByteLength,
  parseCount,
  randomBytes,
  type TokenFormat,
} from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const FORMATS = [
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' },
  { value: 'base64url', label: 'Base64url' },
  { value: 'binary', label: 'Raw binary' },
] as const satisfies ReadonlyArray<{ value: TokenFormat; label: string }>;

function filename(format: TokenFormat): string {
  if (format === 'hex') return 'random.hex';
  if (format === 'binary') return 'random.bin';
  return 'random.txt';
}

export default function TokenGeneratorTool() {
  const [countText, setCountText] = useState('1');
  const [bytesText, setBytesText] = useState(String(DEFAULT_BYTES));
  const [format, setFormat] = useState<TokenFormat>('hex');
  const [text, setText] = useState('');
  const [raw, setRaw] = useState<Uint8Array | null>(null);
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string>();

  const generate = useCallback(() => {
    try {
      const count = parseCount(countText);
      const byteLength = parseByteLength(bytesText);
      const block = randomBytes(byteLength, count, random);
      setRaw(block);
      setCommand(opensslCommand(byteLength, format));
      if (format === 'binary') {
        const blocks =
          count === 1 ? `${byteLength} bytes` : `${count} blocks of ${byteLength} bytes (${block.length} bytes)`;
        setText(`${blocks}, raw binary.`);
      } else {
        const lines: string[] = [];
        for (let i = 0; i < count; i++) {
          lines.push(encodeRandom(block.subarray(i * byteLength, (i + 1) * byteLength), format));
        }
        setText(lines.join('\n'));
      }
      setError(undefined);
    } catch (e) {
      setText('');
      setRaw(null);
      setCommand('');
      setError(errorMessage(e));
    }
  }, [countText, bytesText, format]);

  // Generate on the client only, so nothing random is baked into the HTML.
  useEffect(generate, [generate]);

  const binary = format === 'binary';
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-3">
        <Input
          label={`Bytes (${MIN_BYTES}–${MAX_BYTES})`}
          value={bytesText}
          onValue={setBytesText}
          inputMode="numeric"
          class="w-40"
          data-xt="input"
          hint="The NUM argument to openssl rand."
        />
        <Select label="Encoding" value={format} options={FORMATS} onValue={setFormat} />
        <Input
          label={`How many (1–${MAX_COUNT})`}
          value={countText}
          onValue={setCountText}
          inputMode="numeric"
          class="w-36"
          hint="Each value is a fresh block of that many bytes."
        />
        <Button variant="primary" onClick={generate}>
          Generate
        </Button>
      </div>
      <p class="text-sm text-muted">
        Drawn with crypto.getRandomValues on this device. Nothing is stored.
        {command ? ` Equivalent command: ${command}` : ''}
        {format === 'base64url' ? ' Base64url is that base64 made URL-safe, with the padding removed.' : ''}
      </p>
      <OutputRegion label="Random bytes">
        <TextArea label="Random bytes" hideLabel value={text} readOnly rows={8} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={text} />
          {binary ? (
            <DownloadButton
              data={raw ?? new Uint8Array()}
              filename={filename(format)}
              mime="application/octet-stream"
              label="Download raw"
            />
          ) : (
            <DownloadButton data={text} filename={filename(format)} label="Download" />
          )}
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
