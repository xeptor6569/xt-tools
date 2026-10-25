import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { isbnEanValidator } from './logic.ts';
import meta from './meta.ts';

export default function IsbnEanValidatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => isbnEanValidator(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        ISBN-10, ISBN-13, EAN-13 and UPC-A are detected automatically. Hyphens and spaces are ignored.
      </p>
      <TwoPane
        inputLabel="ISBN, EAN or UPC"
        inputPlaceholder="9780306406157"
        input={input}
        onInput={setInput}
        outputLabel="Check digit"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
