import { useMemo, useState } from 'preact/hooks';
import SandboxedPreview from '../../components/ui/SandboxedPreview.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { svgOptimizer } from './logic.ts';
import meta from './meta.ts';

export default function SvgOptimizerTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => svgOptimizer(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Comments, the XML declaration, Inkscape and Sodipodi markup, and whitespace between tags are removed. Image
        links that are not data: or a #fragment are dropped.
      </p>
      <TwoPane
        inputLabel="SVG"
        input={input}
        onInput={setInput}
        outputLabel="Optimized SVG"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
      {result.output && <SandboxedPreview html={result.output} title="Optimized SVG preview" class="h-64" />}
    </div>
  );
}
