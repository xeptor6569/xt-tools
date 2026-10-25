import { useMemo, useState } from 'preact/hooks';
import AlgorithmSelect from '../../components/ui/AlgorithmSelect.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { HMAC_ALGORITHMS, hmacGenerator, type HmacAlgorithm } from './logic.ts';
import meta from './meta.ts';

export default function HmacGeneratorTool() {
  const [input, setInput] = useState('');
  const [algo, setAlgo] = useState<HmacAlgorithm>('sha256');
  const result = useMemo(() => runTool(() => hmacGenerator(input, algo)), [input, algo]);
  const legacy = HMAC_ALGORITHMS.find((a) => a.value === algo)?.legacy;

  return (
    <TwoPane
      inputLabel="Key headers and message"
      inputPlaceholder={'key: secret\nThe quick brown fox jumps over the lazy dog'}
      input={input}
      onInput={setInput}
      outputLabel="HMAC"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <AlgorithmSelect
          label="Algorithm"
          value={algo}
          options={HMAC_ALGORITHMS}
          onValue={setAlgo}
          hint={legacy ? undefined : 'An algo: line in the text overrides this menu.'}
        />
      }
    />
  );
}
