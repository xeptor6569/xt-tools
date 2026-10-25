import { useMemo, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { dnsRecords, recipeFromForm, type DnsForm, type DnsKind } from './logic.ts';
import meta from './meta.ts';

const KINDS = [
  { value: 'SPF', label: 'SPF' },
  { value: 'DMARC', label: 'DMARC' },
  { value: 'CAA', label: 'CAA' },
  { value: 'SRV', label: 'SRV' },
  { value: 'DKIM', label: 'DKIM' },
] as const satisfies ReadonlyArray<{ value: DnsKind; label: string }>;

const emptyForm = (): DnsForm => ({
  kind: 'SPF',
  domain: '',
  spf: 'mx -all',
  dmarcPolicy: 'reject',
  dmarcRua: '',
  dmarcAdkim: '',
  dmarcAspf: '',
  caaFlags: '0',
  caaTag: 'issue',
  caaValue: 'letsencrypt.org',
  srvService: 'sip',
  srvProto: 'tcp',
  srvPriority: '10',
  srvWeight: '20',
  srvPort: '5060',
  srvTarget: '',
  dkimSelector: 's1',
  dkimKey: '',
});

export default function DnsRecordsTool() {
  const [recipe, setRecipe] = useState('');
  const [form, setForm] = useState<DnsForm>(emptyForm);
  const result = useMemo(() => runTool(() => dnsRecords(recipe)), [recipe]);

  const update = (patch: Partial<DnsForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    const built = recipeFromForm(next);
    if (built !== '') setRecipe(built);
  };

  return (
    <TwoPane
      inputLabel="Recipe"
      input={recipe}
      onInput={setRecipe}
      inputPlaceholder="SPF example.com mx -all"
      outputLabel="Record"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <div class="flex w-full flex-col gap-3">
          <p class="text-sm text-muted">
            Type a recipe, or fill in the form. Paste a DKIM public key; this page does not generate keys.
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <Select label="Record type" value={form.kind} options={KINDS} onValue={(kind) => update({ kind })} />
            <Input
              label="Domain"
              value={form.domain}
              onValue={(domain) => update({ domain })}
              placeholder="example.com"
            />
            {form.kind === 'SPF' && (
              <div class="sm:col-span-2">
                <Input
                  label="Mechanisms"
                  value={form.spf}
                  onValue={(spf) => update({ spf })}
                  placeholder="mx a:mail.example.com -all"
                />
              </div>
            )}
            {form.kind === 'DMARC' && (
              <>
                <Select
                  label="Policy"
                  value={form.dmarcPolicy}
                  options={[
                    { value: 'none', label: 'none' },
                    { value: 'quarantine', label: 'quarantine' },
                    { value: 'reject', label: 'reject' },
                  ]}
                  onValue={(dmarcPolicy) => update({ dmarcPolicy })}
                />
                <Input
                  label="Aggregate reports"
                  value={form.dmarcRua}
                  onValue={(dmarcRua) => update({ dmarcRua })}
                  placeholder="dmarc@example.com"
                />
              </>
            )}
            {form.kind === 'CAA' && (
              <>
                <Select
                  label="Tag"
                  value={form.caaTag}
                  options={[
                    { value: 'issue', label: 'issue' },
                    { value: 'issuewild', label: 'issuewild' },
                    { value: 'iodef', label: 'iodef' },
                  ]}
                  onValue={(caaTag) => update({ caaTag })}
                />
                <Input label="Flags" value={form.caaFlags} onValue={(caaFlags) => update({ caaFlags })} />
                <div class="sm:col-span-2">
                  <Input
                    label="Value"
                    value={form.caaValue}
                    onValue={(caaValue) => update({ caaValue })}
                    placeholder="letsencrypt.org"
                  />
                </div>
              </>
            )}
            {form.kind === 'SRV' && (
              <>
                <Input label="Service" value={form.srvService} onValue={(srvService) => update({ srvService })} />
                <Input label="Protocol" value={form.srvProto} onValue={(srvProto) => update({ srvProto })} />
                <Input label="Priority" value={form.srvPriority} onValue={(srvPriority) => update({ srvPriority })} />
                <Input label="Weight" value={form.srvWeight} onValue={(srvWeight) => update({ srvWeight })} />
                <Input label="Port" value={form.srvPort} onValue={(srvPort) => update({ srvPort })} />
                <Input
                  label="Target"
                  value={form.srvTarget}
                  onValue={(srvTarget) => update({ srvTarget })}
                  placeholder="sip.example.com"
                />
              </>
            )}
            {form.kind === 'DKIM' && (
              <>
                <Input
                  label="Selector"
                  value={form.dkimSelector}
                  onValue={(dkimSelector) => update({ dkimSelector })}
                />
                <div class="sm:col-span-2">
                  <TextArea
                    label="Public key"
                    value={form.dkimKey}
                    onValue={(dkimKey) => update({ dkimKey })}
                    rows={4}
                    hint="Paste the p= value. No key is generated here."
                  />
                </div>
              </>
            )}
          </div>
        </div>
      }
    />
  );
}
