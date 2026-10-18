import { useEffect, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { deviceTimeZone, timeZoneOptions } from '../../lib/time-zones.ts';
import { timeZones } from './logic.ts';
import meta from './meta.ts';

const DEFAULT_TARGETS = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

function nowIn(zone: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(Date.now())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export default function TimeZonesTool() {
  const [zones, setZones] = useState([{ value: 'UTC', label: 'UTC' }]);
  const [source, setSource] = useState('UTC');
  const [targets, setTargets] = useState<string[]>(DEFAULT_TARGETS);
  const [adding, setAdding] = useState('Australia/Sydney');
  const [input, setInput] = useState('2026-10-14 09:00');

  useEffect(() => {
    const zone = deviceTimeZone();
    setZones(timeZoneOptions());
    setSource(zone);
    setInput(nowIn(zone));
  }, []);

  const result = useMemo(() => runTool(() => timeZones(input, source, targets)), [input, source, targets]);
  const r = result.output;
  const zoneList = r?.conversions.map((c) => c.zone) ?? [];
  const columns = [
    { key: 'source', label: `${source} (source)` },
    ...zoneList.slice(1).map((z, i) => ({ key: `z${i + 1}`, label: z })),
  ];
  const rows: Array<Record<string, string>> =
    r?.planner.map((p) => ({
      source: `${p.allWorking ? '✓ ' : ''}${p.sourceHour}`,
      ...Object.fromEntries(p.cells.slice(1).map((c, i) => [`z${i + 1}`, `${c.working ? '● ' : ''}${c.time}`])),
    })) ?? [];

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <Input
          label="Date and time"
          value={input}
          onValue={setInput}
          placeholder="2026-10-14 15:30"
          class="w-48 font-mono"
          data-xt="input"
        />
        <Select label="In time zone" value={source} options={zones} onValue={setSource} />
        <Button onClick={() => setInput(nowIn(source))}>Now</Button>
        <ExampleButton examples={meta.examples} onPick={setInput} />
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <Select label="Add a time zone" value={adding} options={zones} onValue={setAdding} />
        <Button onClick={() => setTargets((t) => (t.includes(adding) ? t : [...t, adding]))}>Add</Button>
      </div>
      <ul class="flex flex-wrap gap-2" aria-label="Compared time zones">
        {targets.map((t) => (
          <li key={t} class="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm">
            {t}
            <button
              type="button"
              class="ml-1 rounded-full px-1 text-muted hover:text-fg"
              aria-label={`Remove ${t}`}
              onClick={() => setTargets((list) => list.filter((x) => x !== t))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <OutputRegion label="Converted times">
        {r && (
          <>
            {r.note && (
              <p role="status" class="text-sm text-warning">
                {r.note}
              </p>
            )}
            <ResultTable
              caption="Converted times"
              columns={[
                { key: 'zone', label: 'Time zone' },
                { key: 'local', label: 'Local time' },
                { key: 'offset', label: 'Offset', mono: true },
              ]}
              rows={r.conversions.map((c) => ({
                ...c,
                local: `${c.local}${c.dayShift ? ` (${c.dayShift > 0 ? 'next' : 'previous'} day)` : ''}`,
              }))}
            />
            <p class="font-mono text-sm text-muted">UTC: {r.utc}</p>
            <h2 class="mt-2 text-base font-semibold">Meeting planner</h2>
            <p class="text-sm text-muted">
              ● marks 09:00–17:00 on a weekday in that zone; ✓ marks hours that are working hours everywhere.
            </p>
            <ResultTable caption="Meeting planner" columns={columns} rows={rows} copy={false} />
          </>
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
