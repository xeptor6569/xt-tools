import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { slugify, type Separator } from './logic.ts';

const SEPARATORS: Array<{ value: Separator; label: string }> = [
  { value: '-', label: 'Hyphen (-)' },
  { value: '_', label: 'Underscore (_)' },
  { value: '.', label: 'Dot (.)' },
];

export default function SlugifyTool() {
  const [input, setInput] = useState('');
  const [separator, setSeparator] = useState<Separator>('-');
  const [lowercase, setLowercase] = useState(true);
  const result = useMemo(() => runTool(() => slugify(input, { separator, lowercase })), [input, separator, lowercase]);

  const controls = (
    <>
      <div class="flex flex-col gap-1">
        <label htmlFor="slug-separator" class="text-sm font-medium">
          Separator
        </label>
        <select
          id="slug-separator"
          value={separator}
          onChange={(e) => setSeparator(e.currentTarget.value as Separator)}
          class="rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg"
        >
          {SEPARATORS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <label class="flex items-center gap-2 py-2 text-sm">
        <input
          type="checkbox"
          checked={lowercase}
          onChange={(e) => setLowercase(e.currentTarget.checked)}
          class="size-4 accent-accent"
        />
        Lowercase
      </label>
    </>
  );

  return (
    <TwoPane
      controls={controls}
      inputLabel="Text"
      input={input}
      onInput={setInput}
      inputPlaceholder="Hello, World! Ça va?"
      outputLabel="Slug"
      output={result.output ?? ''}
      error={result.error}
    />
  );
}
