import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Tabs from '../../components/ui/Tabs.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { dockerComposeConverter, type Direction, type Note } from './logic.ts';
import meta from './meta.ts';

const TABS = [
  { id: 'run-to-compose', label: 'docker run → Compose' },
  { id: 'compose-to-run', label: 'Compose → docker run' },
] as const satisfies ReadonlyArray<{ id: Direction; label: string }>;

const COMPOSE_EXAMPLE = `services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
    volumes:
      - ./site:/usr/share/nginx/html:ro
    depends_on:
      - api
  api:
    build: ./api
    environment:
      DATABASE_URL: postgres://db/app
    restart: unless-stopped
`;

export default function DockerComposeConverterTool() {
  const [direction, setDirection] = useState<Direction>('run-to-compose');
  const [inputs, setInputs] = useState<Record<Direction, string>>({ 'run-to-compose': '', 'compose-to-run': '' });
  const input = inputs[direction];
  const setInput = (value: string) => setInputs((prev) => ({ ...prev, [direction]: value }));
  const text = useDebounced(input, 150);
  const result = useMemo(() => runTool(() => dockerComposeConverter(text, direction)), [text, direction]);
  const output = result.output?.text ?? '';
  const notes = result.output?.notes ?? [];
  const toCompose = direction === 'run-to-compose';
  const other: Direction = toCompose ? 'compose-to-run' : 'run-to-compose';

  return (
    <Tabs label="Direction" tabs={TABS} value={direction} onValue={setDirection}>
      <div class="flex flex-col gap-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-2">
            <TextArea
              label={toCompose ? 'docker run commands' : 'Compose file'}
              value={input}
              onValue={setInput}
              rows={12}
              placeholder={
                toCompose ? 'docker run -d -p 8080:80 --name web nginx' : 'services:\n  web:\n    image: nginx'
              }
              hint={
                toCompose
                  ? 'One or more commands, separated by new lines, ; or &&. Backslash line continuations are fine.'
                  : 'A compose.yaml file. Each service becomes one docker run command.'
              }
              data-xt="input"
            />
            {toCompose ? (
              <ExampleButton examples={meta.examples} onPick={setInput} />
            ) : (
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="text-muted">Try:</span>
                <Button class="min-h-7 px-2 py-0.5 text-xs" onClick={() => setInput(COMPOSE_EXAMPLE)}>
                  Example
                </Button>
              </div>
            )}
          </div>
          <div class="flex flex-col gap-2" aria-live="polite">
            <TextArea
              label={toCompose ? 'compose.yaml' : 'docker run commands'}
              value={output}
              readOnly
              rows={12}
              data-xt="output"
            />
            <div class="flex flex-wrap items-center gap-2">
              <CopyButton text={output} />
              <DownloadButton
                data={output}
                filename={toCompose ? 'compose.yaml' : 'run.sh'}
                mime={toCompose ? 'application/yaml;charset=utf-8' : 'text/x-shellscript;charset=utf-8'}
              />
              <Button
                disabled={!output}
                onClick={() => {
                  setInputs((prev) => ({ ...prev, [other]: output }));
                  setDirection(other);
                }}
              >
                Convert back
              </Button>
            </div>
            <ErrorMessage message={result.error} />
            <NoteList notes={notes} />
          </div>
        </div>
      </div>
    </Tabs>
  );
}

function NoteList({ notes }: { notes: readonly Note[] }) {
  if (notes.length === 0) return null;
  const sorted = [...notes.filter((n) => n.level === 'warning'), ...notes.filter((n) => n.level === 'info')];
  return (
    <section aria-label="Conversion notes" class="flex flex-col gap-1">
      <h2 class="text-sm font-semibold">Notes</h2>
      <ul class="flex flex-col gap-1 text-sm" data-xt="notes">
        {sorted.map((n, i) => (
          <li
            key={i}
            class={n.level === 'warning' ? 'rounded-md bg-warning-bg px-2 py-1 text-warning' : 'px-2 py-1 text-muted'}
          >
            <span class="font-medium">{n.level === 'warning' ? 'Warning: ' : 'Note: '}</span>
            {n.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
