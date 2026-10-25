import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { cssClamp } from './logic.ts';
import meta from './meta.ts';

export default function CssClampTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => cssClamp(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Minimum and maximum size, then the viewport widths where each applies. Example: min 16 max 24 from 320 to 1280.
      </p>
      <TwoPane
        inputLabel="Sizes and viewports"
        inputPlaceholder="min 16 max 24 from 320 to 1280"
        input={input}
        onInput={setInput}
        outputLabel="clamp()"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
