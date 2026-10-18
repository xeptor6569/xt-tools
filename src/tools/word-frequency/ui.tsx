import { useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { wordFrequency } from './logic.ts';
import meta from './meta.ts';

export default function WordFrequencyTool() {
  const [input, setInput] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(true);
  const [excludeStopWords, setExclude] = useState(false);
  const [minLength, setMinLength] = useState('1');
  const text = useDebounced(input, 200);
  const result = useMemo(
    () => runTool(() => wordFrequency(text, { ignoreCase, excludeStopWords, minLength: Number(minLength) || 1 })),
    [text, ignoreCase, excludeStopWords, minLength],
  );
  const r = result.output;

  return (
    <div class="flex flex-col gap-4">
      <TextArea label="Text" value={input} onValue={setInput} data-xt="input" />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Toggle label="Ignore case" checked={ignoreCase} onChecked={setIgnoreCase} />
        <Toggle label="Skip common English words" checked={excludeStopWords} onChecked={setExclude} />
        <Input label="Minimum length" value={minLength} onValue={setMinLength} inputMode="numeric" class="w-20" />
      </div>
      <OutputRegion label="Word counts">
        {r && r.totalWords > 0 && (
          <>
            <p class="text-sm text-muted">
              {r.totalWords.toLocaleString('en-US')} words, {r.uniqueWords.toLocaleString('en-US')} distinct
              {r.uniqueWords > r.rows.length ? ` (showing the top ${r.rows.length})` : ''}.
            </p>
            <ResultTable
              caption="Word counts"
              columns={[
                { key: 'word', label: 'Word' },
                { key: 'count', label: 'Count' },
                { key: 'share', label: 'Share of all words' },
              ]}
              rows={r.rows}
            />
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
