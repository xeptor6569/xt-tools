import { useMemo, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import { rows, SECTIONS, type Row } from './data.ts';
import { ALL_SECTIONS, gitCheatsheet, MAX_QUERY } from './logic.ts';

const COLUMNS = [
  { key: 'section', label: 'Section' },
  { key: 'command', label: 'Command', mono: true },
  { key: 'description', label: 'Description' },
] as const satisfies ReadonlyArray<{ key: keyof Row & string; label: string; mono?: boolean }>;

const SECTION_OPTIONS = [
  { value: ALL_SECTIONS, label: 'All sections' },
  ...SECTIONS.map((s) => ({ value: s, label: s })),
];

export default function GitCheatsheetTool() {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string>(ALL_SECTIONS);
  const matches = useMemo(() => gitCheatsheet(rows, query, section), [query, section]);
  // The section column is redundant once a single section is picked.
  const columns = section === ALL_SECTIONS ? COLUMNS : COLUMNS.slice(1);

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-4">
        <div class="min-w-0 flex-1 basis-60">
          <Input
            label="Search"
            type="search"
            value={query}
            onValue={setQuery}
            placeholder="e.g. rebase, undo commit, stash"
            maxLength={MAX_QUERY}
            class="w-full"
            data-xt="input"
          />
        </div>
        <Select label="Section" value={section} options={SECTION_OPTIONS} onValue={setSection} />
      </div>
      <OutputRegion label="Matches">
        <p class="text-sm text-muted">
          {matches.length} of {rows.length} commands
        </p>
        <ResultTable caption="Git commands" columns={columns} rows={matches} empty="No matching commands." />
      </OutputRegion>
    </div>
  );
}
