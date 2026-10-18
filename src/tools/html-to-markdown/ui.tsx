import { useMemo, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { htmlToMarkdown, type BulletMarker, type HeadingStyle } from './logic.ts';
import meta from './meta.ts';

const HEADINGS = [
  { value: 'atx', label: '# Heading' },
  { value: 'setext', label: 'Heading + underline' },
] as const satisfies ReadonlyArray<{ value: HeadingStyle; label: string }>;

const BULLETS = [
  { value: '-', label: '- item' },
  { value: '*', label: '* item' },
  { value: '+', label: '+ item' },
] as const satisfies ReadonlyArray<{ value: BulletMarker; label: string }>;

export default function HtmlToMarkdownTool() {
  const [input, setInput] = useState('');
  const [headingStyle, setHeadingStyle] = useState<HeadingStyle>('atx');
  const [bulletListMarker, setBullet] = useState<BulletMarker>('-');
  const [gfm, setGfm] = useState(true);
  const html = useDebounced(input, 200);
  const result = useMemo(
    () => runTool(() => htmlToMarkdown(html, { headingStyle, bulletListMarker, gfm })),
    [html, headingStyle, bulletListMarker, gfm],
  );
  const output = result.output ?? '';

  return (
    <TwoPane
      controls={
        <>
          <Select label="Headings" value={headingStyle} options={HEADINGS} onValue={setHeadingStyle} />
          <Select label="Bullets" value={bulletListMarker} options={BULLETS} onValue={setBullet} />
          <Toggle label="GitHub tables and task lists" checked={gfm} onChecked={setGfm} />
        </>
      }
      inputLabel="HTML"
      input={input}
      onInput={setInput}
      inputPlaceholder="<h1>Hello</h1><p>Paste HTML here.</p>"
      outputLabel="Markdown"
      output={output}
      error={result.error}
      examples={meta.examples}
      actions={<DownloadButton data={output} filename="converted.md" mime="text/markdown;charset=utf-8" />}
    />
  );
}
