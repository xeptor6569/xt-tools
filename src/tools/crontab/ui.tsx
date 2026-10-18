import { useEffect, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { crontab, PRESETS, type Zone } from './logic.ts';

const ZONES = [
  { value: 'local', label: 'This device’s time zone' },
  { value: 'UTC', label: 'UTC' },
] as const satisfies ReadonlyArray<{ value: Zone; label: string }>;

export default function CrontabTool() {
  const [input, setInput] = useState('*/15 9-17 * * 1-5');
  const [zone, setZone] = useState<Zone>('local');
  // The server render uses the build time; the browser refreshes it on every change.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => setNow(new Date()), [input, zone]);

  const result = useMemo(() => runTool(() => crontab(input, { now, zone })), [input, zone, now]);
  const format = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
        timeStyle: 'long',
        ...(zone === 'UTC' ? { timeZone: 'UTC' } : {}),
      }),
    [zone],
  );
  const runs =
    result.output?.nextRuns.map((d, i) => ({ n: String(i + 1), when: format.format(d), iso: d.toISOString() })) ?? [];

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <div class="min-w-64 flex-1">
          <Input
            label="Cron expression"
            value={input}
            onValue={setInput}
            hint="minute hour day-of-month month day-of-week, an optional seconds field first, or @daily, @hourly…"
            class="font-mono"
            data-xt="input"
          />
        </div>
        <Select label="Show times in" value={zone} options={ZONES} onValue={setZone} />
      </div>
      <div class="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.expression} class="min-h-7 px-2 py-0.5 text-xs" onClick={() => setInput(p.expression)}>
            {p.label}
          </Button>
        ))}
      </div>
      <OutputRegion label="Schedule">
        {result.output && (
          <>
            <p class="text-lg font-semibold" data-xt="description">
              {result.output.description}
            </p>
            <h2 class="mt-2 text-base font-semibold">Next runs</h2>
            <ResultTable
              caption="Next runs"
              columns={[
                { key: 'n', label: '#' },
                { key: 'when', label: 'When' },
                { key: 'iso', label: 'ISO 8601 (UTC)', mono: true },
              ]}
              rows={runs}
            />
            <h2 class="mt-2 text-base font-semibold">Fields</h2>
            <ResultTable
              caption="Fields"
              copy={false}
              columns={[
                { key: 'name', label: 'Field' },
                { key: 'value', label: 'Value', mono: true },
                { key: 'allowed', label: 'Allowed values' },
              ]}
              rows={result.output.fields}
            />
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
