import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { formatBoxShadowInput, parseBoxShadow } from './logic.ts';
import meta from './meta.ts';

const FALLBACK = { x: 4, y: 8, blur: 24, spread: 0, color: '#000000', inset: false };

export default function BoxShadowTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => parseBoxShadow(input)), [input]);
  const shadow = result.output;
  const preview = useRef<HTMLDivElement>(null);

  useEffect(() => {
    preview.current?.style.setProperty('--preview', shadow?.value ?? 'none');
  }, [shadow]);

  return (
    <div class="flex flex-col gap-4">
      <div class="flex justify-center rounded-lg bg-surface p-10">
        <div
          ref={preview}
          role="img"
          aria-label={shadow ? `Preview of ${shadow.css}` : 'Box shadow preview'}
          class="h-24 w-48 rounded-lg border border-border bg-bg [box-shadow:var(--preview)]"
        />
      </div>
      <TwoPane
        controls={
          <Toggle
            label="Inset"
            checked={shadow?.inset ?? false}
            onChecked={(inset) => setInput(formatBoxShadowInput({ ...(shadow ?? FALLBACK), inset }))}
          />
        }
        inputLabel="Offset, blur, spread and color"
        inputPlaceholder="4 8 24 0 #000000"
        input={input}
        onInput={setInput}
        outputLabel="CSS"
        output={shadow?.css ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
