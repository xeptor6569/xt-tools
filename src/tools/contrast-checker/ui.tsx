import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { parseContrast } from './logic.ts';
import meta from './meta.ts';

export default function ContrastCheckerTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => parseContrast(input)), [input]);
  const report = result.output;
  const preview = useRef<HTMLDivElement>(null);
  const foreground = report?.foreground ?? '#000000';
  const background = report?.background ?? '#ffffff';

  useEffect(() => {
    const el = preview.current;
    if (!el) return;
    el.style.setProperty('--preview', background);
    el.style.setProperty('--preview-fg', foreground);
  }, [background, foreground]);

  return (
    <div class="flex flex-col gap-4">
      <div ref={preview} class="rounded-lg border border-border bg-(--preview) p-4 text-(--preview-fg)">
        <p>The quick brown fox jumps over the lazy dog.</p>
        <p class="text-2xl font-bold">Large text</p>
      </div>
      <TwoPane
        controls={
          <>
            <label class="flex flex-col gap-1 text-sm font-medium">
              Foreground
              <input
                type="color"
                value={foreground}
                onInput={(event) => setInput(`${event.currentTarget.value} ${background}`)}
                class="h-10 w-16 cursor-pointer rounded-md border border-border bg-bg"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm font-medium">
              Background
              <input
                type="color"
                value={background}
                onInput={(event) => setInput(`${foreground} ${event.currentTarget.value}`)}
                class="h-10 w-16 cursor-pointer rounded-md border border-border bg-bg"
              />
            </label>
          </>
        }
        inputLabel="Foreground and background"
        inputPlaceholder="#000000 #ffffff"
        input={input}
        onInput={setInput}
        outputLabel="WCAG contrast"
        output={report?.text ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
