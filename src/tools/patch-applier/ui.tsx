import { useMemo, useState } from 'preact/hooks';
import Button, { buttonClass } from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { patchApplier } from './logic.ts';
import meta from './meta.ts';
import { SAMPLE_ORIGINAL, SAMPLE_PATCH } from './samples.ts';

const MAX_FILE = 2_000_000;

const FUZZ = [
  { value: '0', label: '0 (exact context)' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function PatchApplierTool() {
  const [patch, setPatch] = useState('');
  const [original, setOriginal] = useState('');
  const [file, setFile] = useState('0');
  const [fuzz, setFuzz] = useState('0');
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [fileError, setFileError] = useState<string>();
  const p = useDebounced(patch, 200);
  const o = useDebounced(original, 200);

  const result = useMemo(
    () =>
      runTool(() =>
        p.trim() === ''
          ? undefined
          : patchApplier(o, p, { file: Number(file), fuzz: Number(fuzz), ignoreWhitespace, reverse }),
      ),
    [p, o, file, fuzz, ignoreWhitespace, reverse],
  );
  const r = result.output;
  const output = r?.text ?? '';
  const selected = r?.files[r.file];
  const failed = r?.hunks.filter((h) => h.status === 'failed').length ?? 0;
  const filename = (selected?.label.split('/').pop() ?? '').replace(/[^\w.-]+/g, '_') || 'patched.txt';

  const pickPatch = (text: string, originalText = '') => {
    setPatch(text);
    setOriginal(originalText);
    setFile('0');
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <TextArea
            label="Patch (unified diff)"
            value={patch}
            onValue={setPatch}
            rows={12}
            placeholder={'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,3 @@\n…'}
            hint="Output of git diff, git format-patch or diff -u."
            data-xt="input"
          />
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <OpenFile label="Open patch file…" onText={setPatch} onError={setFileError} />
            <span class="text-muted">Try:</span>
            <Button class="min-h-7 px-2 py-0.5 text-xs" onClick={() => pickPatch(SAMPLE_PATCH, SAMPLE_ORIGINAL)}>
              Edit a file
            </Button>
            {meta.examples?.[0] && (
              <Button class="min-h-7 px-2 py-0.5 text-xs" onClick={() => pickPatch(meta.examples![0]!.input)}>
                New file
              </Button>
            )}
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <TextArea
            label="Original text"
            value={original}
            onValue={setOriginal}
            rows={12}
            hint="The file the patch applies to. Leave it empty for a patch that creates a new file."
          />
          <div>
            <OpenFile label="Open original file…" onText={setOriginal} onError={setFileError} />
          </div>
        </div>
      </div>
      <ErrorMessage message={fileError} />

      <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
        {r && r.files.length > 1 && (
          <Select
            label="File in the patch"
            value={String(r.file)}
            onValue={setFile}
            options={r.files.map((f) => ({
              value: String(f.index),
              label: `${f.label} (${plural(f.hunks, 'hunk')}${f.note ? `, ${f.note}` : ''})`,
            }))}
          />
        )}
        <Select
          label="Fuzz factor"
          value={fuzz}
          onValue={setFuzz}
          options={FUZZ}
          hint="How many context lines may differ."
        />
        <Toggle
          label="Ignore whitespace"
          checked={ignoreWhitespace}
          onChecked={setIgnoreWhitespace}
          hint="Match lines that differ only in spaces or tabs."
        />
        <Toggle label="Reverse (undo the patch)" checked={reverse} onChecked={setReverse} />
      </div>

      <div class="flex flex-col gap-2" aria-live="polite">
        <TextArea
          label={r && !r.complete ? 'Patched text (partial)' : 'Patched text'}
          value={output}
          readOnly
          rows={12}
          data-xt="output"
        />
        <div class="flex flex-wrap items-center gap-2">
          <CopyButton text={output} />
          <DownloadButton data={output} filename={filename} />
        </div>
        <ErrorMessage message={result.error} />
        {r && (
          <section aria-label="Patch summary" class="flex flex-col gap-2">
            {r.hunks.length > 0 &&
              (failed === 0 ? (
                <p class="text-sm" data-xt="summary">
                  <span class="font-medium text-success">
                    {reverse ? 'Reversed' : 'Applied'} {plural(r.hunks.length, 'hunk')}
                  </span>{' '}
                  to {selected?.label}: {plural(r.added, 'line')} added, {r.removed} removed.
                </p>
              ) : (
                <p class="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning" data-xt="summary">
                  {failed} of {plural(r.hunks.length, 'hunk')} could not be applied to {selected?.label}. The text above
                  contains only the hunks that applied.
                </p>
              ))}
            {r.notes.map((n, i) => (
              <p key={i} class="text-sm text-muted">
                {n}
              </p>
            ))}
            {r.hunks.length > 0 && (
              <ResultTable
                caption="Hunks"
                copy={false}
                columns={[
                  { key: 'n', label: '#' },
                  { key: 'header', label: 'Hunk', mono: true },
                  { key: 'status', label: 'Status' },
                  { key: 'change', label: 'Lines', mono: true },
                  { key: 'reason', label: 'Details' },
                ]}
                rows={r.hunks.map((h, i) => ({
                  n: String(i + 1),
                  header: h.header,
                  status: h.status === 'applied' ? 'Applied' : 'Failed',
                  change: `+${h.added} −${h.removed}`,
                  reason: h.reason ?? '',
                }))}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function OpenFile(props: { label: string; onText: (text: string) => void; onError: (e: string | undefined) => void }) {
  return (
    <label class={`${buttonClass('secondary')} cursor-pointer focus-within:outline-2 focus-within:outline-accent`}>
      {props.label}
      <input
        type="file"
        class="sr-only"
        onChange={async (e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          input.value = '';
          if (!f) return;
          if (f.size > MAX_FILE) {
            props.onError(`${f.name} is larger than 2 MB.`);
            return;
          }
          props.onError(undefined);
          props.onText(await f.text());
        }}
      />
    </label>
  );
}
