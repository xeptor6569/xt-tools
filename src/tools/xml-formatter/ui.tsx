import { useMemo, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { formatXml, type Indent } from './logic.ts';
import meta from './meta.ts';

const INDENTS = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
  { value: 'tab', label: 'Tabs' },
  { value: 'minify', label: 'Minify' },
] as const satisfies ReadonlyArray<{ value: Indent; label: string }>;

type Wrap = '0' | '80' | '100' | '120';
const WRAPS = [
  { value: '0', label: 'Never' },
  { value: '80', label: 'Past 80 columns' },
  { value: '100', label: 'Past 100 columns' },
  { value: '120', label: 'Past 120 columns' },
] as const satisfies ReadonlyArray<{ value: Wrap; label: string }>;

export default function XmlFormatterTool() {
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState<Indent>('2');
  const [collapseEmpty, setCollapseEmpty] = useState(false);
  const [wrap, setWrap] = useState<Wrap>('0');
  const debounced = useDebounced(input, 150);

  const result = useMemo(
    () => runTool(() => formatXml(debounced, { indent, collapseEmpty, wrapAttributes: Number(wrap) })),
    [debounced, indent, collapseEmpty, wrap],
  );
  const output = result.output ?? '';

  return (
    <TwoPane
      controls={
        <>
          <Select label="Indentation" value={indent} options={INDENTS} onValue={setIndent} />
          <Select label="One attribute per line" value={wrap} options={WRAPS} onValue={setWrap} />
          <Toggle label="Collapse empty elements to <x/>" checked={collapseEmpty} onChecked={setCollapseEmpty} />
        </>
      }
      inputLabel="XML"
      input={input}
      onInput={setInput}
      inputPlaceholder="<root><item>Paste XML here</item></root>"
      outputLabel={indent === 'minify' ? 'Minified XML' : 'Formatted XML'}
      output={output}
      error={result.error}
      busy={debounced !== input}
      examples={meta.examples}
      actions={<DownloadButton data={output} filename="formatted.xml" mime="application/xml;charset=utf-8" />}
    />
  );
}
