import { useEffect, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { deviceTimeZone, timeZoneOptions } from '../../lib/time-zones.ts';
import { dateTime } from './logic.ts';
import meta from './meta.ts';

export default function DateTimeTool() {
  const [input, setInput] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [zones, setZones] = useState([{ value: 'UTC', label: 'UTC' }]);
  const [now, setNow] = useState(() => Date.now());

  // Browser-only details (time zones, the current time) are read after mount.
  useEffect(() => {
    setZones(timeZoneOptions());
    setTimeZone(deviceTimeZone());
  }, []);
  useEffect(() => setNow(Date.now()), [input]);

  const result = useMemo(() => runTool(() => dateTime(input, { now, timeZone })), [input, now, timeZone]);
  const rows = result.output?.batch?.map((r) => ({ input: r.input, iso: r.error ?? r.iso, unix: r.unix })) ?? [];

  return (
    <div class="flex flex-col gap-4">
      <TextArea
        label="Date, time or Unix timestamp"
        value={input}
        onValue={setInput}
        rows={3}
        class="min-h-20"
        placeholder="1760443200, 2026-10-14T10:00:00+02:00 or Wed, 14 Oct 2026 08:00:00 GMT"
        hint="Paste several, one per line, to convert them all. Timestamps in seconds, milliseconds, microseconds and nanoseconds are detected by length."
        data-xt="input"
      />
      <div class="flex flex-wrap items-end gap-3">
        <Button onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Now</Button>
        <ExampleButton examples={meta.examples} onPick={setInput} />
        <div class="ml-auto">
          <Select label="Time zone" value={timeZone} options={zones} onValue={setTimeZone} />
        </div>
      </div>
      <OutputRegion label="Converted dates">
        {result.output?.single && <KeyValueList items={result.output.single} />}
        {rows.length > 0 && (
          <ResultTable
            caption="Converted dates"
            columns={[
              { key: 'input', label: 'Input', mono: true },
              { key: 'iso', label: 'ISO 8601 (UTC)', mono: true },
              { key: 'unix', label: 'Unix seconds', mono: true },
            ]}
            rows={rows}
          />
        )}
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
