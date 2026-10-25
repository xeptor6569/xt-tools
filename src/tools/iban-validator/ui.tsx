import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { ibanValidator } from './logic.ts';
import meta from './meta.ts';

export default function IbanValidatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => ibanValidator(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Spaces are ignored. A valid IBAN has a MOD-97 remainder of 1 and is shown in groups of four.
      </p>
      <TwoPane
        inputLabel="IBAN"
        inputPlaceholder="GB82WEST12345698765432"
        input={input}
        onInput={setInput}
        outputLabel="Result"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
