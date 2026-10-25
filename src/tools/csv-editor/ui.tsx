import { useEffect, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { csvTextTable, deleteEmptyRows, transposeCsv } from './logic.ts';
import meta from './meta.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function CsvEditorTool() {
  const call = useWorker(createWorker);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setBusy(true);
    call<string>('csvEditor', input)
      .then(
        (value) => {
          if (!current) return;
          setOutput(value);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input, call]);

  const preview = useMemo(() => {
    try {
      return csvTextTable(input);
    } catch {
      return '';
    }
  }, [input]);

  function rewrite(fn: (value: string) => string) {
    try {
      setInput(fn(input));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Edit the CSV on the left. Quoted fields can contain commas and line breaks. The output is CSV again.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button onClick={() => rewrite(transposeCsv)} disabled={busy || input.trim() === ''}>
          Transpose
        </Button>
        <Button onClick={() => rewrite(deleteEmptyRows)} disabled={busy || input.trim() === ''}>
          Delete empty rows
        </Button>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <TextArea label="CSV" value={input} onValue={setInput} data-xt="input" placeholder={'a,b\n1,2'} />
        <div class="flex flex-col gap-2">
          <TextArea label="CSV output" value={output} readOnly data-xt="output" aria-busy={busy ? 'true' : undefined} />
          <div class="flex flex-wrap items-center gap-2">
            <CopyButton text={output} />
            <DownloadButton data={output} filename="edited.csv" mime="text/csv" />
          </div>
          <ErrorMessage message={error} />
        </div>
      </div>
      <ExampleButton examples={meta.examples} onPick={setInput} />
      {preview && (
        <div class="flex flex-col gap-1">
          <h2 class="text-sm font-medium">Preview</h2>
          <pre
            aria-label="Table preview"
            class="overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-sm whitespace-pre"
          >
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}
