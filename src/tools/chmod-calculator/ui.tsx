import { useEffect, useMemo, useState } from 'preact/hooks';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { chmodCalculator, formatLike, SETGID, SETUID, STICKY, type ModeFormat } from './logic.ts';
import meta from './meta.ts';

const CLASSES = [
  { name: 'Owner', shift: 6 },
  { name: 'Group', shift: 3 },
  { name: 'Others', shift: 0 },
] as const;

const PERMS = [
  { name: 'Read', bit: 4 },
  { name: 'Write', bit: 2 },
  { name: 'Execute', bit: 1 },
] as const;

const SPECIALS = [
  { name: 'Setuid', bit: SETUID, hint: '4000' },
  { name: 'Setgid', bit: SETGID, hint: '2000' },
  { name: 'Sticky', bit: STICKY, hint: '1000' },
] as const;

interface Current {
  bits: number;
  format: ModeFormat;
  fileType: string;
}

const EMPTY: Current = { bits: 0, format: 'octal', fileType: '-' };

export default function ChmodCalculatorTool() {
  const [input, setInput] = useState('755');
  const result = useMemo(() => runTool(() => chmodCalculator(input)), [input]);

  // Keep the grid on the last valid mode while the user is mid-edit.
  const [last, setLast] = useState<Current>({ bits: 0o755, format: 'octal', fileType: '-' });
  const output = result.output;
  useEffect(() => {
    if (output) setLast({ bits: output.bits, format: output.format, fileType: output.fileType });
  }, [output]);
  const current: Current = output ?? (input.trim() === '' ? EMPTY : last);

  const toggle = (bit: number) => setInput(formatLike(current.format, current.bits ^ bit, current.fileType));

  return (
    <div class="flex flex-col gap-4">
      <div class="max-w-xl">
        <Input
          label="Mode"
          value={input}
          onValue={setInput}
          placeholder="755, -rw-r--r--, u=rwx,g=rx,o="
          hint="Octal (755, 0644, 4755), symbolic (rwxr-xr-x, drwxr-sr-x) or chmod syntax (u=rwx,g=rx,o=, a+x)."
          class="font-mono"
          data-xt="input"
        />
      </div>
      <ExampleButton examples={meta.examples} onPick={setInput} />

      <fieldset class="flex flex-col gap-3">
        <legend class="mb-2 text-sm font-medium">Permissions</legend>
        <div class="overflow-x-auto">
          <table class="border-collapse text-sm">
            <caption class="sr-only">Read, write and execute permissions per class</caption>
            <thead>
              <tr>
                <th scope="col" class="px-3 py-1">
                  <span class="sr-only">Class</span>
                </th>
                {PERMS.map((p) => (
                  <th key={p.name} scope="col" class="px-3 py-1 font-semibold">
                    {p.name}
                  </th>
                ))}
                <th scope="col" class="px-3 py-1 font-semibold">
                  Octal
                </th>
              </tr>
            </thead>
            <tbody>
              {CLASSES.map((c) => (
                <tr key={c.name} class="border-t border-border">
                  <th scope="row" class="py-2 pr-3 text-left font-semibold">
                    {c.name}
                  </th>
                  {PERMS.map((p) => {
                    const bit = p.bit << c.shift;
                    return (
                      <td key={p.name} class="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(current.bits & bit)}
                          onChange={() => toggle(bit)}
                          aria-label={`${c.name} ${p.name.toLowerCase()}`}
                          class="size-5 accent-accent"
                        />
                      </td>
                    );
                  })}
                  <td class="px-3 py-2 text-center font-mono">{(current.bits >> c.shift) & 7}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-x-6 gap-y-2">
          {SPECIALS.map((s) => (
            <label key={s.name} class="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(current.bits & s.bit)}
                onChange={() => toggle(s.bit)}
                class="size-4 accent-accent"
              />
              {s.name} <span class="font-mono text-muted">({s.hint})</span>
            </label>
          ))}
        </div>
      </fieldset>

      <OutputRegion label="File mode">
        {output && (
          <>
            {output.notes.map((n) => (
              <p key={n} role="note" class="rounded-lg border border-warning bg-warning-bg p-3 text-sm text-fg">
                {n}
              </p>
            ))}
            <KeyValueList items={output.items} />
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
