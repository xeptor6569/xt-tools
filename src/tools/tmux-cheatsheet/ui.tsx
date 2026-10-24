import { useMemo, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import { rows, SECTIONS, type Row } from './data.ts';
import { ALL_SECTIONS, MAX_QUERY, tmuxCheatsheet } from './logic.ts';

const COLUMNS = [
  { key: 'section', label: 'Section' },
  { key: 'keys', label: 'Keys or command', mono: true },
  { key: 'description', label: 'Description' },
] as const satisfies ReadonlyArray<{ key: keyof Row & string; label: string; mono?: boolean }>;

const SECTION_OPTIONS = [
  { value: ALL_SECTIONS, label: 'All sections' },
  ...SECTIONS.map((s) => ({ value: s, label: s })),
];

export default function TmuxCheatsheetTool() {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string>(ALL_SECTIONS);
  const matches = useMemo(() => tmuxCheatsheet(rows, query, section), [query, section]);
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
            placeholder="e.g. split, detach, copy mode"
            maxLength={MAX_QUERY}
            class="w-full"
            data-xt="input"
          />
        </div>
        <Select label="Section" value={section} options={SECTION_OPTIONS} onValue={setSection} />
      </div>
      <p class="text-sm text-muted">
        Default prefix: press <kbd class="font-mono">Ctrl-b</kbd>, release, then the key. Commands starting with : go at
        the <kbd class="font-mono">Ctrl-b :</kbd> prompt or after <code class="font-mono">tmux</code> in a shell.
      </p>
      <OutputRegion label="Matches">
        <p class="text-sm text-muted">
          {matches.length} of {rows.length} entries
        </p>
        <ResultTable caption="tmux keys and commands" columns={columns} rows={matches} empty="No matches." />
      </OutputRegion>
    </div>
  );
}
