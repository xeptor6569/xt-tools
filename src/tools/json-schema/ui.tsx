import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import ResultTable from '../../components/ui/ResultTable.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import {
  DRAFT_LABELS,
  DRAFTS,
  generateSchema,
  MAX_ERRORS,
  validateJson,
  type RequiredMode,
  type SchemaDraft,
} from './logic.ts';
import meta from './meta.ts';

const DRAFT_OPTIONS = DRAFTS.map((d) => ({ value: d, label: DRAFT_LABELS[d] }));

const REQUIRED_OPTIONS = [
  { value: 'present', label: 'Keys present in every sample' },
  { value: 'all', label: 'Every key seen' },
  { value: 'none', label: 'None' },
] as const satisfies ReadonlyArray<{ value: RequiredMode; label: string }>;

const SAMPLE_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      age: { type: 'integer', minimum: 0 },
      email: { type: 'string', format: 'email' },
      tags: { type: 'array', items: { $ref: '#/$defs/tag' } },
    },
    required: ['name', 'age'],
    additionalProperties: false,
    $defs: { tag: { type: 'string', maxLength: 10 } },
  },
  null,
  2,
);
const SAMPLE_JSON = JSON.stringify(
  { name: 'Ada', age: -1, email: 'ada at example', tags: ['math'], extra: true },
  null,
  2,
);

export default function JsonSchemaTool() {
  const [input, setInput] = useState('');
  const [schema, setSchema] = useState('');
  const [draft, setDraft] = useState<SchemaDraft>('2020-12');
  const [required, setRequired] = useState<RequiredMode>('present');
  const [noAdditional, setNoAdditional] = useState(false);
  const [formats, setFormats] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const args = useDebounced(
    useMemo(() => ({ input, schema }), [input, schema]),
    150,
  );
  const generating = schema.trim() === '';

  const generated = useMemo(
    () => (generating ? runTool(() => generateSchema(args.input, { required, noAdditional, formats })) : undefined),
    [generating, args.input, required, noAdditional, formats],
  );
  const report = useMemo(
    () =>
      !generating && args.schema.trim() !== ''
        ? runTool(() => validateJson(args.input, args.schema, draft))
        : undefined,
    [generating, args, draft],
  );
  const output = generated?.output ?? '';
  const rows = report?.output?.errors.filter((e) => showSummary || !e.summary) ?? [];
  const hidden = (report?.output?.errors.length ?? 0) - rows.length;

  return (
    <div class="flex flex-col gap-4">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <TextArea
            label="JSON"
            value={input}
            onValue={setInput}
            placeholder='{"name": "Ada", "age": 36}'
            data-xt="input"
          />
          <ExampleButton examples={meta.examples} onPick={setInput} />
        </div>
        <div class="flex flex-col gap-2">
          <TextArea
            label="Schema"
            value={schema}
            onValue={setSchema}
            placeholder='{"type": "object", "required": ["name"]}'
            hint="Leave empty to generate a schema from the JSON."
          />
          <div class="flex flex-wrap gap-2">
            <Button
              class="min-h-7 px-2 py-0.5 text-xs"
              onClick={() => {
                setSchema(SAMPLE_SCHEMA);
                setInput(SAMPLE_JSON);
              }}
            >
              Load a sample schema
            </Button>
            <Button class="min-h-7 px-2 py-0.5 text-xs" disabled={generating} onClick={() => setSchema('')}>
              Clear schema
            </Button>
          </div>
        </div>
      </div>

      {generating ? (
        <section aria-label="Schema generator" class="flex flex-col gap-3">
          <div class="flex flex-wrap items-end gap-4">
            <Select label="Required properties" value={required} options={REQUIRED_OPTIONS} onValue={setRequired} />
            <Toggle label="additionalProperties: false" checked={noAdditional} onChecked={setNoAdditional} />
            <Toggle
              label="Detect formats"
              checked={formats}
              onChecked={setFormats}
              hint="date-time, date, email, uuid, uri, ipv4"
            />
          </div>
          <div class="flex flex-col gap-2" aria-live="polite">
            <TextArea label="Generated schema" value={output} readOnly data-xt="output" class="min-h-64" />
            <div class="flex flex-wrap items-center gap-2">
              <CopyButton text={output} />
              <DownloadButton data={output} filename="schema.json" mime="application/schema+json" />
              <Button variant="primary" disabled={output === ''} onClick={() => setSchema(output)}>
                Use as schema
              </Button>
            </div>
            <ErrorMessage message={generated?.error} />
          </div>
        </section>
      ) : (
        <>
          <div class="flex flex-wrap items-end gap-4">
            <Select
              label="Draft"
              value={draft}
              options={DRAFT_OPTIONS}
              onValue={setDraft}
              hint="Used when the schema has no recognised $schema."
            />
            <Toggle label="Show summary errors" checked={showSummary} onChecked={setShowSummary} />
          </div>
          <OutputRegion label="Validation result">
            {report?.output && (
              <>
                {report.output.valid ? (
                  <p
                    class="rounded-lg border border-border bg-surface p-3 font-semibold text-success"
                    data-xt="verdict"
                  >
                    ✓ Valid
                  </p>
                ) : (
                  <p class="rounded-lg bg-danger-bg p-3 font-semibold text-danger" data-xt="verdict">
                    ✗ Invalid: {report.output.total} error{report.output.total === 1 ? '' : 's'}
                    {report.output.total > MAX_ERRORS ? ` (showing the first ${MAX_ERRORS})` : ''}
                  </p>
                )}
                <p class="text-sm text-muted">
                  Checked with {DRAFT_LABELS[report.output.draft]}{' '}
                  {report.output.fromSchema ? '(from $schema).' : '(selected).'}
                </p>
                {report.output.notes.map((n) => (
                  <p key={n} class="text-sm text-warning">
                    {n}
                  </p>
                ))}
                {!report.output.valid && (
                  <>
                    <ResultTable
                      caption="Validation errors"
                      columns={[
                        { key: 'instance', label: 'Instance location', mono: true },
                        { key: 'keyword', label: 'Keyword', mono: true },
                        { key: 'schemaLocation', label: 'Schema location', mono: true },
                        { key: 'message', label: 'Message' },
                      ]}
                      rows={rows.map((r) => ({ ...r, instance: r.instance === '' ? '(root)' : r.instance }))}
                    />
                    {hidden > 0 && (
                      <p class="text-xs text-muted">
                        {hidden} summary error{hidden === 1 ? '' : 's'} (such as “A subschema had errors.”) hidden.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            <ErrorMessage message={report?.error} />
          </OutputRegion>
        </>
      )}
      <p class="text-xs text-muted">
        Validation runs in your browser with @cfworker/json-schema. Only references inside the schema are resolved;
        nothing is downloaded.
      </p>
    </div>
  );
}
