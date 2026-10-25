import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { formatGradientInput, parseGradient } from './logic.ts';
import meta from './meta.ts';

export default function GradientGeneratorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => parseGradient(input)), [input]);
  const gradient = result.output;
  const preview = useRef<HTMLDivElement>(null);
  const angle = gradient?.angle ?? 90;
  const from = gradient?.from.slice(0, 7) ?? '#000000';
  const to = gradient?.to.slice(0, 7) ?? '#ffffff';

  useEffect(() => {
    preview.current?.style.setProperty('--preview', gradient?.css ?? 'none');
  }, [gradient]);

  return (
    <div class="flex flex-col gap-4">
      <div
        ref={preview}
        role="img"
        aria-label={gradient ? `Preview of ${gradient.css}` : 'Gradient preview'}
        class="h-24 rounded-lg border border-border [background-image:var(--preview)]"
      />
      <TwoPane
        controls={
          <>
            <Input
              label="Angle"
              value={String(angle)}
              inputMode="decimal"
              class="w-24"
              onValue={(value) => {
                const next = Number(value);
                setInput(formatGradientInput(Number.isFinite(next) ? next : 0, from, to));
              }}
            />
            <label class="flex flex-col gap-1 text-sm font-medium">
              From
              <input
                type="color"
                value={from}
                onInput={(event) => setInput(formatGradientInput(angle, event.currentTarget.value, to))}
                class="h-10 w-16 cursor-pointer rounded-md border border-border bg-bg"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
              To
              <input
                type="color"
                value={to}
                onInput={(event) => setInput(formatGradientInput(angle, from, event.currentTarget.value))}
                class="h-10 w-16 cursor-pointer rounded-md border border-border bg-bg"
              />
            </label>
          </>
        }
        inputLabel="Angle and colors"
        inputPlaceholder="90 #000000 #ffffff"
        input={input}
        onInput={setInput}
        outputLabel="CSS"
        output={gradient?.css ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
