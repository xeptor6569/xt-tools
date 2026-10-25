import { useMemo, useState } from 'preact/hooks';
import SandboxedPreview from '../../components/ui/SandboxedPreview.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { svgPlaceholder } from './logic.ts';
import meta from './meta.ts';

export default function SvgPlaceholderTool() {
  const [input, setInput] = useState('640 480 Hello');
  const result = useMemo(() => runTool(() => svgPlaceholder(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">Type width, height and an optional label. Example: 640 480 Hello.</p>
      <TwoPane
        inputLabel="Size and label"
        input={input}
        onInput={setInput}
        inputPlaceholder="640 480 Hello"
        outputLabel="SVG"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
      {result.output && <SandboxedPreview html={result.output} title="SVG placeholder preview" class="h-64" />}
    </div>
  );
}
