import { useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { useLookup } from '../../components/ui/useLookup.ts';
import { networkJson } from '../../lib/network.ts';
import { parseRdap, whoisUrl, type WhoisRow } from './logic.ts';

export default function WhoisLookupTool() {
  const [query, setQuery] = useState('example.com');
  const lookup = useLookup<WhoisRow[]>();

  function submit(event: { preventDefault(): void }): void {
    event.preventDefault();
    lookup.run(async (signal) =>
      parseRdap(await networkJson(whoisUrl(query), { signal, headers: { accept: 'application/rdap+json' } })),
    );
  }

  return (
    <form class="flex flex-col gap-4" onSubmit={submit}>
      <div class="flex flex-wrap items-end gap-4">
        <Input
          label="Domain or IP address"
          value={query}
          onValue={setQuery}
          data-xt="input"
          class="min-w-64 flex-1"
          hint="Domains are limited to .com, .net and .org. IP addresses are asked of ARIN, which does not refer this page to another registry."
        />
        <Button variant="primary" type="submit" disabled={lookup.pending}>
          {lookup.pending ? 'Looking up…' : 'Look up'}
        </Button>
      </div>
      <ErrorMessage message={lookup.error} />
      <OutputRegion label="Registration data" busy={lookup.pending}>
        {lookup.output && <KeyValueList items={lookup.output} />}
      </OutputRegion>
    </form>
  );
}
