import { useMemo, useState } from 'preact/hooks';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { geoConverter } from './logic.ts';
import meta from './meta.ts';

export default function GeoConverterTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => geoConverter(input)), [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">Decimal degrees with latitude first, DMS with N/S and E/W, or a geohash.</p>
      <TwoPane
        inputLabel="Coordinates"
        inputPlaceholder="48.8584, 2.2945"
        input={input}
        onInput={setInput}
        outputLabel="Decimal, DMS and geohash"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
