import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { vatValidator } from './logic.ts';
import meta from './meta.ts';

export default function VatValidatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => vatValidator(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Format only for EU countries and GB. Nothing is sent to VIES or any tax registry.
      </p>
      <TwoPane
        inputLabel="VAT number"
        inputPlaceholder="DE136695976"
        input={input}
        onInput={setInput}
        outputLabel="Format check"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
