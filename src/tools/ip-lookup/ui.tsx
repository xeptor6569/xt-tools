import { useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { useLookup } from '../../components/ui/useLookup.ts';
import { NetworkError, networkJson } from '../../lib/network.ts';
import { ipifyUrl, ipwhoUrl, parseIpQuery, parseIpify, parseIpwho, type IpFact } from './logic.ts';

async function lookupAddress(address: string | undefined, signal: AbortSignal): Promise<IpFact[]> {
  if (address) return parseIpwho(await networkJson(ipwhoUrl(address), { signal }));

  const [v4, v6, geo] = await Promise.allSettled([
    networkJson(ipifyUrl(4), { signal }).then(parseIpify),
    networkJson(ipifyUrl(6), { signal }).then(parseIpify),
    networkJson(ipwhoUrl(), { signal }).then(parseIpwho),
  ]);
  if (signal.aborted) throw new DOMException('aborted', 'AbortError');

  const rows: IpFact[] = [];
  if (v4.status === 'fulfilled') rows.push({ label: 'Public IPv4', value: v4.value });
  if (v6.status === 'fulfilled' && v6.value !== (v4.status === 'fulfilled' ? v4.value : undefined)) {
    rows.push({ label: 'Public IPv6', value: v6.value });
  }
  if (geo.status === 'fulfilled') {
    for (const row of geo.value) {
      if (row.label === 'IP address') continue;
      rows.push(row);
    }
  }
  if (rows.length === 0) {
    const reason = [v4, v6, geo].find((item) => item.status === 'rejected');
    if (reason?.status === 'rejected' && reason.reason instanceof NetworkError) throw reason.reason;
    throw new NetworkError('The lookup could not reach the address services. Check your connection and try again.');
  }
  return rows;
}

export default function IpLookupTool() {
  const [address, setAddress] = useState('');
  const lookup = useLookup<IpFact[]>();

  function submit(event: { preventDefault(): void }): void {
    event.preventDefault();
    lookup.run(async (signal) => {
      const query = parseIpQuery(address);
      return lookupAddress(query.kind === 'address' ? query.address : undefined, signal);
    });
  }

  return (
    <form class="flex flex-col gap-4" onSubmit={submit}>
      <div class="flex flex-wrap items-end gap-4">
        <Input
          label="IP address"
          value={address}
          onValue={setAddress}
          data-xt="input"
          class="min-w-64 flex-1"
          placeholder="Leave blank for this connection"
          hint="A blank field asks for this connection. An address asks only for that address's location."
        />
        <Button variant="primary" type="submit" disabled={lookup.pending}>
          {lookup.pending ? 'Looking up…' : 'Look up'}
        </Button>
      </div>
      <ErrorMessage message={lookup.error} />
      <OutputRegion label="IP address" busy={lookup.pending}>
        {lookup.output && <KeyValueList items={lookup.output} />}
      </OutputRegion>
    </form>
  );
}
