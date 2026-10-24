import { useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import { useLookup } from '../../components/ui/useLookup.ts';
import { networkJson } from '../../lib/network.ts';
import { DNS_TYPES, dnsUrl, parseDoh, type DnsResult, type DnsType } from './logic.ts';

const COLUMNS = [
  { key: 'name', label: 'Name', mono: true },
  { key: 'type', label: 'Type', mono: true },
  { key: 'ttl', label: 'TTL', mono: true },
  { key: 'data', label: 'Data', mono: true },
] as const;

export default function DnsLookupTool() {
  const [name, setName] = useState('example.com');
  const [type, setType] = useState<DnsType>('A');
  const lookup = useLookup<DnsResult>();

  function submit(event: { preventDefault(): void }): void {
    event.preventDefault();
    lookup.run(async (signal) =>
      parseDoh(await networkJson(dnsUrl(name, type), { signal, headers: { accept: 'application/dns-json' } })),
    );
  }

  return (
    <form class="flex flex-col gap-4" onSubmit={submit}>
      <div class="flex flex-wrap items-end gap-4">
        <Input label="Domain name" value={name} onValue={setName} data-xt="input" class="min-w-64 flex-1" />
        <Select
          label="Type"
          value={type}
          onValue={(value) => setType(value as DnsType)}
          options={DNS_TYPES.map((item) => ({ value: item, label: item }))}
        />
        <Button variant="primary" type="submit" disabled={lookup.pending}>
          {lookup.pending ? 'Looking up…' : 'Look up'}
        </Button>
      </div>
      <p class="text-sm text-muted">
        This asks Cloudflare's public resolver once. It is not a check of how the name resolves everywhere.
      </p>
      <ErrorMessage message={lookup.error} />
      <OutputRegion label="DNS records" busy={lookup.pending}>
        {lookup.output && (
          <>
            <p class="text-sm">
              Status <span class="font-mono">{lookup.output.status}</span>
            </p>
            <ResultTable
              caption="DNS answers"
              columns={[...COLUMNS]}
              rows={lookup.output.answers}
              empty="The resolver returned no answers."
            />
          </>
        )}
      </OutputRegion>
    </form>
  );
}
