import { useEffect, useMemo, useState } from 'preact/hooks';
import LoadingState from '../../components/ui/LoadingState.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import { loadMimeDb, lookupMime, type MimeDb } from './logic.ts';
import meta from './meta.ts';

export default function MimeTypesTool() {
  const [input, setInput] = useState('');
  const [db, setDb] = useState<MimeDb>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let current = true;
    loadMimeDb().then(
      (value) => {
        if (current) setDb(value);
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
    if (!db) return { output: '', error: loadError };
    return runTool(() => lookupMime(db, input));
  }, [db, input, loadError]);

  return (
    <div class="flex flex-col gap-4">
      {!db && !loadError && <LoadingState label="Loading the media-type database…" />}
      <TwoPane
        inputLabel="Extension or type"
        inputPlaceholder=".png or application/json"
        input={input}
        onInput={setInput}
        outputLabel="Match"
        output={result.output ?? ''}
        error={result.error}
        examples={meta.examples}
      />
    </div>
  );
}
