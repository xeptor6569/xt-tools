import { useEffect, useMemo, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { useWorker } from '../../components/ui/useWorker.ts';
import { errorMessage } from '../../lib/run-tool.ts';
import { MAX_MATCHES, segments, type RegexResult } from './logic.ts';

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const TIMEOUT_MS = 2000;

const FLAGS = [
  { flag: 'g', label: 'Global (g)' },
  { flag: 'i', label: 'Ignore case (i)' },
  { flag: 'm', label: 'Multiline (m)' },
  { flag: 's', label: 'Dot matches newline (s)' },
  { flag: 'u', label: 'Unicode (u)' },
] as const;

export default function RegexTesterTool() {
  const call = useWorker(createWorker, { timeoutMs: TIMEOUT_MS });
  const [pattern, setPattern] = useState('(?<word>\\w+)@(\\w+)\\.com');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('Write to alice@example.com or bob@test.com.');
  const [replacement, setReplacement] = useState('');
  const [useReplace, setUseReplace] = useState(false);
  const [result, setResult] = useState<RegexResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const request = useMemo(
    () => ({ pattern, flags, text, replacement: useReplace ? replacement : undefined }),
    [pattern, flags, text, replacement, useReplace],
  );
  const args = useDebounced(request, 150);

  useEffect(() => {
    let current = true;
    setBusy(true);
    call<RegexResult>('regexTest', args.pattern, args.flags, args.text, args.replacement)
      .then(
        (value) => {
          if (!current) return;
          setResult(value);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setResult(undefined);
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [args, call]);

  const pieces = useMemo(() => (result ? segments(args.text, result.matches) : []), [result, args.text]);
  const rows =
    result?.matches.map((m, i) => ({
      n: String(i + 1),
      at: `${m.index}–${m.end}`,
      text: m.text,
      groups: m.groups.map((g) => `${g.name}: ${g.value ?? '∅'}`).join(', '),
    })) ?? [];
  const toggle = (flag: string, on: boolean) =>
    setFlags((f) => (on ? [...new Set([...f, flag])].join('') : f.replace(flag, '')));

  return (
    <div class="flex flex-col gap-4">
      <div class="grid gap-4 md:grid-cols-[1fr_8rem]">
        <Input label="Pattern" value={pattern} onValue={setPattern} class="font-mono" data-xt="input" />
        <Input label="Flags" value={flags} onValue={setFlags} class="font-mono" hint="d g i m s u v y" />
      </div>
      <div class="flex flex-wrap gap-x-6">
        {FLAGS.map(({ flag, label }) => (
          <Toggle key={flag} label={label} checked={flags.includes(flag)} onChecked={(on) => toggle(flag, on)} />
        ))}
      </div>
      <TextArea label="Test text" value={text} onValue={setText} rows={6} class="min-h-32" />
      <div class="flex flex-col gap-2">
        <Toggle label="Replace" checked={useReplace} onChecked={setUseReplace} />
        {useReplace && (
          <Input
            label="Replacement"
            value={replacement}
            onValue={setReplacement}
            class="font-mono"
            hint="$1, $2… for numbered groups, $<name> for named groups, $& for the whole match."
          />
        )}
      </div>
      <OutputRegion label="Matches" busy={busy}>
        {result && (
          <>
            <p class="text-sm text-muted" data-xt="match-count">
              {result.matches.length === 0
                ? 'No matches.'
                : `${result.matches.length}${result.truncated ? '+' : ''} match${result.matches.length === 1 ? '' : 'es'}${
                    result.truncated ? ` (showing the first ${MAX_MATCHES})` : ''
                  }.`}
            </p>
            <pre class="rounded-lg border border-border bg-surface p-3 font-mono text-sm break-words whitespace-pre-wrap">
              {pieces.map((p, i) =>
                p.match < 0 ? (
                  p.text
                ) : (
                  <mark key={i} class="rounded-sm bg-accent px-0.5 text-accent-fg">
                    {p.text}
                  </mark>
                ),
              )}
            </pre>
            {result.replaced !== undefined && (
              <div class="flex flex-col gap-2">
                <TextArea label="Result after replace" value={result.replaced} readOnly rows={4} class="min-h-24" />
                <div>
                  <CopyButton text={result.replaced} />
                </div>
              </div>
            )}
            {rows.length > 0 && (
              <ResultTable
                caption="Matches"
                columns={[
                  { key: 'n', label: '#' },
                  { key: 'at', label: 'Position' },
                  { key: 'text', label: 'Match', mono: true },
                  { key: 'groups', label: 'Groups', mono: true },
                ]}
                rows={rows}
              />
            )}
          </>
        )}
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
