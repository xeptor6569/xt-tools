import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { colorConverter } from './logic.ts';
import meta from './meta.ts';

export default function ColorConverterTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => colorConverter(input)), [input]);
  const swatch = useRef<HTMLDivElement>(null);
  const color = result.output?.swatch;

  // Set through the CSSOM: inline style attributes are blocked by the CSP.
  useEffect(() => {
    swatch.current?.style.setProperty('--swatch', color ?? 'transparent');
  }, [color]);

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <div class="min-w-64 flex-1">
          <Input
            label="Color"
            value={input}
            onValue={setInput}
            placeholder="#663399, rgb(102 51 153), oklch(0.44 0.16 303)…"
            hint="Any CSS color: hex, rgb(), hsl(), hwb(), lab(), lch(), oklch(), color(display-p3 …) or a name."
            class="font-mono"
            data-xt="input"
          />
        </div>
        <label class="flex flex-col gap-1 text-sm font-medium">
          Picker
          <input
            type="color"
            value={result.output?.formats[0]?.value.slice(0, 7) ?? '#000000'}
            onInput={(e) => setInput(e.currentTarget.value)}
            class="h-10 w-16 cursor-pointer rounded-md border border-border bg-bg"
          />
        </label>
      </div>
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <OutputRegion label="Converted color">
        {result.output && (
          <>
            <div
              ref={swatch}
              role="img"
              aria-label={`Preview of ${result.output.formats[0]?.value ?? 'the color'}`}
              class="h-20 rounded-lg border border-border bg-(--swatch)"
            />
            <KeyValueList items={result.output.formats} />
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
