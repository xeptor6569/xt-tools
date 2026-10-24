import { useEffect, useId, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { loadLocalAsset } from '../../lib/load-local-asset.ts';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import { DATA_FILE } from './dataset.ts';
import {
  generateGitignore,
  GROUPS,
  POPULAR,
  searchTemplates,
  templateLabel,
  type GitignoreData,
  type GitignoreTemplate,
} from './logic.ts';

const chip =
  'inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:border-accent';

export default function GitignoreGeneratorTool() {
  const [data, setData] = useState<GitignoreData>();
  const [loadError, setLoadError] = useState<string>();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [dedupe, setDedupe] = useState(true);
  const q = useDebounced(query, 100);
  const id = useId();
  const extraText = useDebounced(extra, 200);

  useEffect(() => {
    loadLocalAsset(DATA_FILE)
      .then((r) => r.json() as Promise<GitignoreData>)
      .then(setData, (e: unknown) => setLoadError(errorMessage(e)));
  }, []);

  const byPath = useMemo(() => new Map((data?.templates ?? []).map((t) => [t.path, t])), [data]);
  const matches = useMemo(() => (data ? searchTemplates(data.templates, q) : []), [data, q]);
  const chosen = useMemo(
    () => selected.map((p) => byPath.get(p)).filter((t): t is GitignoreTemplate => t !== undefined),
    [selected, byPath],
  );
  const result = useMemo(
    () => runTool(() => generateGitignore(chosen, { dedupe, extra: extraText })),
    [chosen, dedupe, extraText],
  );
  const output = result.output ?? '';

  const toggle = (path: string, on: boolean) =>
    setSelected((s) => (on ? (s.includes(path) ? s : [...s, path]) : s.filter((p) => p !== path)));
  const isOn = (path: string) => selected.includes(path);

  return (
    <div class="grid gap-6 md:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-4">
        <Input
          label="Search templates"
          type="search"
          value={query}
          onValue={setQuery}
          placeholder="Node, Python, Unity, Terraform…"
          data-xt="input"
        />
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium" id={`${id}-popular`}>
            Popular
          </span>
          <div class="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-popular`}>
            {POPULAR.map((path) => {
              const t = byPath.get(path);
              const on = isOn(path);
              return (
                <button
                  key={path}
                  type="button"
                  aria-pressed={on}
                  disabled={!t}
                  onClick={() => toggle(path, !on)}
                  class={`${chip} ${on ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface text-fg'}`}
                >
                  {t ? templateLabel(t) : (path.split('/').pop() ?? path).replace(/\.gitignore$/, '')}
                </button>
              );
            })}
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-medium" id={`${id}-selected`}>
              Selected ({chosen.length})
            </span>
            <Button
              class="min-h-7 px-2 py-0.5 text-xs"
              disabled={selected.length === 0}
              onClick={() => setSelected([])}
            >
              Clear all
            </Button>
          </div>
          {chosen.length === 0 ? (
            <p class="text-sm text-muted">Nothing selected yet. Pick templates below or from the popular list.</p>
          ) : (
            <ul class="flex flex-wrap gap-2" aria-labelledby={`${id}-selected`}>
              {chosen.map((t) => (
                <li key={t.path}>
                  <button
                    type="button"
                    class={`${chip} border-border bg-surface text-fg`}
                    onClick={() => toggle(t.path, false)}
                    aria-label={`Remove ${templateLabel(t)}`}
                  >
                    {templateLabel(t)}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!data && !loadError && <LoadingState label="Loading templates…" />}
        <ErrorMessage message={loadError} />
        {data && (
          <div class="flex max-h-[28rem] flex-col gap-4 overflow-y-auto rounded-lg border border-border p-3">
            {matches.length === 0 && <p class="text-sm text-muted">No templates match “{query}”.</p>}
            {GROUPS.map((group) => {
              const list = matches.filter((t) => t.group === group);
              if (list.length === 0) return null;
              return (
                <fieldset key={group} class="flex flex-col gap-2">
                  <legend class="mb-1 text-sm font-semibold">
                    {group} <span class="font-normal text-muted">({list.length})</span>
                  </legend>
                  <div class="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
                    {list.map((t) => (
                      <label key={t.path} class="flex min-w-0 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          class="size-4 shrink-0 accent-accent"
                          checked={isOn(t.path)}
                          onChange={(e) => toggle(t.path, e.currentTarget.checked)}
                        />
                        <span class="truncate" title={t.path}>
                          {templateLabel(t)}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}

        <TextArea
          label="Extra rules"
          value={extra}
          onValue={setExtra}
          rows={4}
          placeholder={'.env\n/secrets/'}
          hint="Appended at the end as a “Custom rules” section."
        />
        <Toggle
          label="Remove duplicate rules"
          checked={dedupe}
          onChecked={setDedupe}
          hint="Keeps comments and the first copy of each rule. Duplicates after a !negation are kept."
        />
      </div>

      <div class="flex min-w-0 flex-col gap-2" aria-live="polite">
        <TextArea label=".gitignore" value={output} readOnly rows={24} data-xt="output" />
        <div class="flex flex-wrap items-center gap-2">
          <CopyButton text={output} />
          <DownloadButton data={output} filename=".gitignore" />
        </div>
        <ErrorMessage message={result.error} />
        {data && (
          <p class="text-xs text-muted">Templates from github/gitignore (CC0-1.0), commit {data.commit.slice(0, 7)}.</p>
        )}
      </div>
    </div>
  );
}
