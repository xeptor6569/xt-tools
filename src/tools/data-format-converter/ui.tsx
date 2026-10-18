import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { FORMATS, type Format } from './formats.ts';
import { dataFormatConverter, type From } from './logic.ts';
import meta from './meta.ts';

const EXT: Record<Format, string> = {
  json: 'json',
  yaml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  csv: 'csv',
  env: 'env',
  ini: 'ini',
  properties: 'properties',
};
const label = (f: Format) => FORMATS.find((x) => x.value === f)?.label ?? f;

export default function DataFormatConverterTool() {
  const [input, setInput] = useState('');
  const [from, setFrom] = useState<From>('auto');
  const [to, setTo] = useState<Format>('yaml');
  const text = useDebounced(input, 150);
  const result = useMemo(() => runTool(() => dataFormatConverter(text, from, to)), [text, from, to]);
  const detected = result.output?.from;
  const output = result.output?.text ?? '';

  return (
    <TwoPane
      controls={
        <>
          <Select
            label="From"
            value={from}
            options={[
              {
                value: 'auto',
                label: detected && from === 'auto' && input.trim() ? `Detect (${label(detected)})` : 'Detect',
              },
              ...FORMATS,
            ]}
            onValue={setFrom}
          />
          <Select label="To" value={to} options={FORMATS} onValue={setTo} />
          <Button
            disabled={!output}
            onClick={() => {
              setInput(output);
              setTo(detected ?? 'json');
              setFrom(to);
            }}
          >
            Swap
          </Button>
        </>
      }
      inputLabel={from === 'auto' ? 'Input' : label(from)}
      input={input}
      onInput={setInput}
      outputLabel={label(to)}
      output={output}
      error={result.error}
      examples={meta.examples}
      actions={<DownloadButton data={output} filename={`converted.${EXT[to]}`} />}
    />
  );
}
