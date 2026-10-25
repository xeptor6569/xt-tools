import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { totp } from './logic.ts';
import meta from './meta.ts';

export default function TotpTool() {
  const [input, setInput] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const result = useMemo(() => runTool(() => totp(input, now)), [input, now]);

  return (
    <TwoPane
      inputLabel="Base32 secret"
      inputPlaceholder={
        'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ\n\nor:\nsecret: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ\ndigits: 6\nperiod: 30\nalgo: sha1\ncode: 287082'
      }
      input={input}
      onInput={setInput}
      outputLabel="Current code"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <Button variant="secondary" onClick={() => setNow(Date.now())}>
          Refresh time
        </Button>
      }
    />
  );
}
