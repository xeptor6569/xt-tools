import { useMemo, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import { rows, type Row } from './data.ts';
import { portReference } from './logic.ts';

const COLUMNS = [
  { key: 'port', label: 'Port', mono: true },
  { key: 'protocol', label: 'Protocol', mono: true },
  { key: 'service', label: 'Service' },
  { key: 'group', label: 'Group' },
  { key: 'description', label: 'Description' },
] as const satisfies ReadonlyArray<{ key: keyof Row & string; label: string; mono?: boolean }>;

export default function PortReferenceTool() {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => portReference(rows, query), [query]);

  return (
    <div class="flex flex-col gap-4">
      <Input label="Search" type="search" value={query} onValue={setQuery} data-xt="input" />
      <OutputRegion label="Matches">
        <p class="text-sm text-muted">
          {matches.length} of {rows.length} entries
        </p>
        <ResultTable caption="Port reference" columns={COLUMNS} rows={matches} empty="No matches." />
      </OutputRegion>
    </div>
  );
}
