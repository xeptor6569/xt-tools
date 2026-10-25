import { useMemo, useState } from 'preact/hooks';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { DEFAULT_CSP, securityHeaders, type FrameOption, type ReferrerOption } from './logic.ts';
import meta from './meta.ts';

const FRAMES = [
  { value: 'DENY', label: 'DENY' },
  { value: 'SAMEORIGIN', label: 'SAMEORIGIN' },
] as const satisfies ReadonlyArray<{ value: FrameOption; label: string }>;

const REFERRERS = [
  { value: 'no-referrer', label: 'no-referrer' },
  { value: 'strict-origin-when-cross-origin', label: 'strict-origin-when-cross-origin' },
  { value: 'same-origin', label: 'same-origin' },
  { value: 'origin-when-cross-origin', label: 'origin-when-cross-origin' },
] as const satisfies ReadonlyArray<{ value: ReferrerOption; label: string }>;

export default function SecurityHeadersTool() {
  const [extra, setExtra] = useState('');
  const [frame, setFrame] = useState<FrameOption>('DENY');
  const [referrer, setReferrer] = useState<ReferrerOption>('no-referrer');
  const [nosniff, setNosniff] = useState(true);
  const [csp, setCsp] = useState(DEFAULT_CSP);
  const result = useMemo(
    () => runTool(() => securityHeaders(extra, { frame, referrer, nosniff, csp })),
    [extra, frame, referrer, nosniff, csp],
  );

  return (
    <TwoPane
      inputLabel="Extra headers"
      inputPlaceholder="Optional lines, one Name: value per line"
      input={extra}
      onInput={setExtra}
      outputLabel="Headers"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <>
          <Select label="X-Frame-Options" value={frame} options={FRAMES} onValue={setFrame} />
          <Select label="Referrer-Policy" value={referrer} options={REFERRERS} onValue={setReferrer} />
          <Toggle label="X-Content-Type-Options: nosniff" checked={nosniff} onChecked={setNosniff} />
          <TextArea label="Content-Security-Policy" value={csp} onValue={setCsp} rows={3} class="min-h-20" />
        </>
      }
    />
  );
}
