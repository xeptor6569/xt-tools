import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { isoCodes } from './logic.ts';
import meta from './meta.ts';

export default function IsoCodesTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => isoCodes(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Enter a code such as US, USD or en, or part of a name. Names are searched with Intl data when this runtime can
        list them.
      </p>
      <TwoPane
        inputLabel="Code or name"
        inputPlaceholder="US"
        input={input}
        onInput={setInput}
        outputLabel="Matches"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
