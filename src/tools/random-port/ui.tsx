import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import {
  knownPortsIn,
  MAX_COUNT,
  parseCount,
  parseExclusions,
  parsePort,
  randomPorts,
  rangeBounds,
  type PortRange,
} from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const RANGE_OPTIONS = [
  { value: 'registered', label: 'Registered (1024–49151)' },
  { value: 'dynamic', label: 'Dynamic / ephemeral (49152–65535)' },
  { value: 'unprivileged', label: 'Any unprivileged (1024–65535)' },
  { value: 'custom', label: 'Custom range' },
] as const satisfies ReadonlyArray<{ value: PortRange; label: string }>;

export default function RandomPortTool() {
  const [countText, setCountText] = useState('5');
  const [range, setRange] = useState<PortRange>('registered');
  const [minText, setMinText] = useState('20000');
  const [maxText, setMaxText] = useState('29999');
  const [skipKnown, setSkipKnown] = useState(true);
  const [excludeText, setExcludeText] = useState('');
  const [sort, setSort] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [values, setValues] = useState<number[]>([]);
  const [error, setError] = useState<string>();

  const generate = useCallback(() => {
    try {
      const custom =
        range === 'custom' ? { min: parsePort(minText, 'Minimum'), max: parsePort(maxText, 'Maximum') } : {};
      const exclude = parseExclusions(excludeText);
      setValues(randomPorts(parseCount(countText), { range, ...custom, skipKnown, exclude, sort }, random));
      setError(undefined);
    } catch (e) {
      setValues([]);
      setError(errorMessage(e));
    }
  }, [countText, range, minText, maxText, skipKnown, excludeText, sort]);

  // Generate on the client only, so nothing random is baked into the HTML.
  useEffect(generate, [generate]);

  // The curated ports inside the current range, for the optional list.
  const skipped = useMemo(
    () =>
      runTool(() => {
        const bounds =
          range === 'custom'
            ? rangeBounds({ range, min: parsePort(minText, 'Minimum'), max: parsePort(maxText, 'Maximum') })
            : rangeBounds({ range });
        return knownPortsIn(bounds.min, bounds.max).map((k) => ({ port: String(k.port), service: k.service }));
      }).output ?? [],
    [range, minText, maxText],
  );

  const text = values.join('\n');
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <Input
          label={`How many (1–${MAX_COUNT})`}
          value={countText}
          onValue={setCountText}
          inputMode="numeric"
          class="w-28"
          data-xt="input"
        />
        <Select label="Range" value={range} options={RANGE_OPTIONS} onValue={setRange} />
        {range === 'custom' && (
          <>
            <Input label="Minimum" value={minText} onValue={setMinText} inputMode="numeric" class="w-24" />
            <Input label="Maximum" value={maxText} onValue={setMaxText} inputMode="numeric" class="w-24" />
          </>
        )}
        <Button variant="primary" onClick={generate}>
          Generate
        </Button>
      </div>
      <div class="max-w-md">
        <Input
          label="Also exclude (optional)"
          value={excludeText}
          onValue={setExcludeText}
          placeholder="8001, 8100-8199"
          hint="Ports or ranges separated by commas or spaces."
          class="font-mono"
        />
      </div>
      <div class="flex flex-wrap gap-x-6">
        <Toggle
          label="Skip well-known and common dev ports"
          checked={skipKnown}
          onChecked={setSkipKnown}
          hint={`${skipped.length} curated port${skipped.length === 1 ? '' : 's'} in this range.`}
        />
        <Toggle label="Sort ascending" checked={sort} onChecked={setSort} />
        <Toggle label="Show the skipped list" checked={showSkipped} onChecked={setShowSkipped} />
      </div>
      <OutputRegion label="Random ports">
        <TextArea label="Random ports" hideLabel value={text} readOnly rows={8} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <DownloadButton data={text} filename="random-ports.txt" />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
      <p class="text-xs text-muted">
        Every usable port in the range is equally likely and no port repeats. A random port can still be taken on your
        machine; check with <code class="font-mono">ss -ltn</code> or <code class="font-mono">lsof -i</code> before
        relying on it.
      </p>
      {showSkipped && (
        <section class="flex flex-col gap-2" aria-label="Skipped ports">
          <h2 class="text-base font-semibold">
            {skipKnown ? 'Ports skipped in this range' : 'Curated ports in this range (not skipped)'}
          </h2>
          <ResultTable
            caption="Well-known and common development ports in the selected range"
            columns={[
              { key: 'port', label: 'Port', mono: true },
              { key: 'service', label: 'Typical service' },
            ]}
            rows={skipped}
            empty="No curated ports fall in this range."
          />
        </section>
      )}
    </div>
  );
}
