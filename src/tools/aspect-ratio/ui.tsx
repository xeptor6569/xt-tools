import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { aspectRatio } from './logic.ts';
import meta from './meta.ts';

export default function AspectRatioTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => aspectRatio(input)), [input]);

  return (
    <TwoPane
      inputLabel="Dimensions or ratio"
      input={input}
      onInput={setInput}
      inputPlaceholder="1920 1080 or 16:9 width 1280"
      outputLabel="Result"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
    />
  );
}
