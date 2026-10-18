import { useMemo, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { invisibleChars, type Kind } from './logic.ts';
import meta from './meta.ts';

const KIND: Record<Kind, string> = {
  invisible: 'Invisible',
  bidi: 'Text direction',
  space: 'Unusual space',
  homoglyph: 'Look-alike',
  control: 'Control',
};

export default function InvisibleCharsTool() {
  const [input, setInput] = useState('');
  const text = useDebounced(input, 150);
  const result = useMemo(() => runTool(() => invisibleChars(text)), [text]);
  const r = result.output;
  const rows =
    r?.findings.map((f) => ({
      where: `${f.line}:${f.column}`,
      code: f.codePoint,
      name: f.name,
      kind: KIND[f.kind],
    })) ?? [];

  return (
    <div class="flex flex-col gap-4">
      <TextArea label="Text to check" value={input} onValue={setInput} data-xt="input" />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <OutputRegion label="Findings">
        {r && text !== '' && (
          <>
            <p class="text-sm" data-xt="summary">
              {r.findings.length === 0
                ? 'No hidden or look-alike characters found.'
                : `${r.findings.length}${r.truncated ? '+' : ''} suspicious character${r.findings.length === 1 ? '' : 's'} found.`}
            </p>
            {rows.length > 0 && (
              <>
                <ResultTable
                  caption="Suspicious characters"
                  columns={[
                    { key: 'where', label: 'Line:column', mono: true },
                    { key: 'code', label: 'Code point', mono: true },
                    { key: 'name', label: 'Name' },
                    { key: 'kind', label: 'Type' },
                  ]}
                  rows={rows}
                />
                <TextArea label="Cleaned text" value={r.cleaned} readOnly rows={5} class="min-h-28" />
                <div>
                  <CopyButton text={r.cleaned} label="Copy cleaned text" />
                </div>
              </>
            )}
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
