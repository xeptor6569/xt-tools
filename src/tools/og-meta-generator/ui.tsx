import { useMemo, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { formatOgLine, ogMetaTags, parseOgLine, type OgFields } from './logic.ts';
import meta from './meta.ts';

export default function OgMetaGeneratorTool() {
  const [line, setLine] = useState('');
  const fields = parseOgLine(line);
  const result = useMemo(() => runTool(() => ogMetaTags(line)), [line]);

  const setField = (key: keyof OgFields, value: string) => setLine(formatOgLine({ ...fields, [key]: value }));

  return (
    <TwoPane
      inputLabel="Title, description, URL and image"
      inputPlaceholder="Title | description | URL | image"
      input={line}
      onInput={setLine}
      outputLabel="Meta tags"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <>
          <Input label="Title" value={fields.title} onValue={(value) => setField('title', value)} />
          <Input label="Description" value={fields.description} onValue={(value) => setField('description', value)} />
          <Input label="URL" value={fields.url} onValue={(value) => setField('url', value)} />
          <Input label="Image URL" value={fields.image} onValue={(value) => setField('image', value)} />
        </>
      }
    />
  );
}
