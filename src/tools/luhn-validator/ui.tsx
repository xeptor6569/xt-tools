import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { luhnValidator } from './logic.ts';
import meta from './meta.ts';

export default function LuhnValidatorTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => luhnValidator(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        For documented test numbers only. The check runs on this device and does not contact a payment service.
      </p>
      <TwoPane
        inputLabel="Test number"
        inputPlaceholder="4242424242424242"
        input={input}
        onInput={setInput}
        outputLabel="Luhn check"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
