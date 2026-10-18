import { useEffect, useMemo, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import FileDropZone, { formatBytes } from '../../components/ui/FileDropZone.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Tabs from '../../components/ui/Tabs.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import { decodeBase64, encodeFile, MAX_BYTES, type Encoded } from './logic.ts';

type Mode = 'encode' | 'decode';
const PREVIEW_CHARS = 200_000;
const preview = (s: string) => (s.length > PREVIEW_CHARS ? `${s.slice(0, PREVIEW_CHARS)}…` : s);

function EncodePanel() {
  const [file, setFile] = useState<{ name: string; size: number }>();
  const [encoded, setEncoded] = useState<Encoded>();
  const [error, setError] = useState<string>();

  const onFiles = async ([f]: File[]) => {
    if (!f) return;
    try {
      setEncoded(encodeFile(new Uint8Array(await f.arrayBuffer()), f.type));
      setFile({ name: f.name, size: f.size });
      setError(undefined);
    } catch (e) {
      setEncoded(undefined);
      setError(errorMessage(e));
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <FileDropZone label="Choose a file to encode" onFiles={onFiles} maxBytes={MAX_BYTES} />
      <OutputRegion label="Base64 output">
        {encoded && file && (
          <>
            <p class="text-sm text-muted">
              {file.name}: {formatBytes(file.size)} → {formatBytes(encoded.base64.length)} of Base64
              {encoded.base64.length > PREVIEW_CHARS ? ' (preview shortened; Copy and Download use the full text)' : ''}
              .
            </p>
            <TextArea label="Base64" value={preview(encoded.base64)} readOnly rows={5} class="min-h-24" />
            <div class="flex flex-wrap gap-2">
              <CopyButton text={encoded.base64} label="Copy Base64" />
              <DownloadButton data={encoded.base64} filename={`${file.name}.b64.txt`} label="Download Base64" />
            </div>
            <TextArea label="Data URI" value={preview(encoded.dataUri)} readOnly rows={3} class="min-h-16" />
            <div>
              <CopyButton text={encoded.dataUri} label="Copy data URI" />
            </div>
          </>
        )}
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}

function DecodePanel() {
  const [input, setInput] = useState('');
  const result = useMemo(
    () => (input.trim() === '' ? { output: undefined, error: undefined } : runTool(() => decodeBase64(input))),
    [input],
  );
  const decoded = result.output;
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!decoded?.mime.startsWith('image/')) return setUrl(undefined);
    const objectUrl = URL.createObjectURL(new Blob([new Uint8Array(decoded.bytes)], { type: decoded.mime }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [decoded]);

  return (
    <div class="flex flex-col gap-4">
      <TextArea
        label="Base64 or data: URI"
        value={input}
        onValue={setInput}
        rows={6}
        class="min-h-32"
        data-xt="input"
      />
      <OutputRegion label="Decoded file">
        {decoded && (
          <>
            <KeyValueList
              copy={false}
              items={[
                { label: 'Type', value: decoded.mime },
                { label: 'Size', value: formatBytes(decoded.bytes.length) },
              ]}
            />
            {url && (
              <img
                src={url}
                alt="Decoded file preview"
                class="max-h-64 max-w-full self-start rounded border border-border"
              />
            )}
            <div>
              <DownloadButton
                data={decoded.bytes}
                mime={decoded.mime}
                filename={`decoded.${decoded.extension}`}
                label="Download file"
              />
            </div>
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}

export default function Base64FileTool() {
  const [mode, setMode] = useState<Mode>('encode');
  return (
    <Tabs
      label="Direction"
      value={mode}
      onValue={setMode}
      tabs={[
        { id: 'encode', label: 'File → Base64' },
        { id: 'decode', label: 'Base64 → file' },
      ]}
    >
      {mode === 'encode' ? <EncodePanel /> : <DecodePanel />}
    </Tabs>
  );
}
