import { useEffect, useMemo, useState } from 'preact/hooks';
import LoadingState from '../../components/ui/LoadingState.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { loadLocalAsset } from '../../lib/load-local-asset.ts';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import { macVendor, type OuiTable } from './logic.ts';
import meta from './meta.ts';

function isOuiTable(value: unknown): value is OuiTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function MacVendorTool() {
  const [input, setInput] = useState('');
  const [table, setTable] = useState<OuiTable>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let current = true;
    import('./dataset.ts')
      .then((mod) => loadLocalAsset(mod.DATA_FILE))
      .then((response) => response.json() as Promise<unknown>)
      .then(
        (data) => {
          if (!current) return;
          if (!isOuiTable(data)) {
            setLoadError('The OUI dataset could not be read.');
            return;
          }
          setTable(data);
        },
        (error: unknown) => {
          if (current) setLoadError(errorMessage(error));
        },
      );
    return () => {
      current = false;
    };
  }, []);

  const result = useMemo(() => {
    if (!table) return { output: '', error: undefined as string | undefined };
    return runTool(() => macVendor(input, table));
  }, [input, table]);

  return (
    <div class="flex flex-col gap-4">
      {!table && !loadError && <LoadingState label="Loading the OUI dataset…" />}
      <TwoPane
        inputLabel="MAC address"
        input={input}
        onInput={setInput}
        inputPlaceholder="00:00:0C:11:22:33"
        outputLabel="Vendor"
        output={result.output ?? ''}
        error={loadError ?? result.error}
        busy={!table && !loadError}
        examples={meta.examples}
      />
    </div>
  );
}
