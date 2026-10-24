import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import Input from '../../components/ui/Input.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import Tabs from '../../components/ui/Tabs.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import {
  buildCompose,
  createDefaultConfig,
  createService,
  parseComposeYaml,
  type ComposeConfig,
  type DependsCondition,
  type DependsOnRow,
  type EnvironmentRow,
  type NetworkConfig,
  type RestartPolicy,
  type ServiceConfig,
  type VolumeConfig,
} from './logic.ts';
import meta from './meta.ts';

const RESTART_OPTIONS = [
  { value: '', label: '(not set)' },
  { value: 'no', label: 'no' },
  { value: 'always', label: 'always' },
  { value: 'on-failure', label: 'on-failure' },
  { value: 'unless-stopped', label: 'unless-stopped' },
] as const satisfies ReadonlyArray<{ value: RestartPolicy; label: string }>;

const DEPENDS_OPTIONS = [
  { value: 'service_started', label: 'service_started' },
  { value: 'service_healthy', label: 'service_healthy' },
  { value: 'service_completed_successfully', label: 'service_completed_successfully' },
] as const satisfies ReadonlyArray<{ value: DependsCondition; label: string }>;

function nextId(rows: ReadonlyArray<{ id: string }>, prefix: string): string {
  let number = rows.length + 1;
  while (rows.some((row) => row.id === `${prefix}-${number}`)) number++;
  return `${prefix}-${number}`;
}

function EnvironmentEditor({ rows, onChange }: { rows: EnvironmentRow[]; onChange: (rows: EnvironmentRow[]) => void }) {
  const update = (id: string, patch: Partial<EnvironmentRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  return (
    <section aria-label="Environment variables" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Environment</h3>
        <Button
          class="min-h-7 px-2 py-0.5 text-xs"
          onClick={() => onChange([...rows, { id: nextId(rows, 'env'), key: '', value: '' }])}
        >
          Add variable
        </Button>
      </div>
      {rows.length === 0 && <p class="text-sm text-muted">No environment variables.</p>}
      {rows.map((row, index) => (
        <div key={row.id} class="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            label={`Environment variable ${index + 1} name`}
            hideLabel
            value={row.key}
            onValue={(key) => update(row.id, { key })}
            placeholder="NAME"
          />
          <Input
            label={`Environment variable ${index + 1} value`}
            hideLabel
            value={row.value}
            onValue={(value) => update(row.id, { value })}
            placeholder="value"
          />
          <Button
            class="min-h-9 px-2 py-1 text-xs"
            aria-label={`Remove environment variable ${index + 1}`}
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
          >
            Remove
          </Button>
        </div>
      ))}
    </section>
  );
}

function DependsEditor({
  rows,
  services,
  currentService,
  onChange,
}: {
  rows: DependsOnRow[];
  services: ServiceConfig[];
  currentService: string;
  onChange: (rows: DependsOnRow[]) => void;
}) {
  const update = (id: string, patch: Partial<DependsOnRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const add = () => {
    const target = services.find((service) => service.id !== currentService)?.name ?? '';
    onChange([...rows, { id: nextId(rows, 'depends'), service: target, condition: 'service_started', extra: '' }]);
  };
  return (
    <section aria-label="Service dependencies" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Depends on</h3>
        <Button class="min-h-7 px-2 py-0.5 text-xs" onClick={add} disabled={services.length < 2}>
          Add dependency
        </Button>
      </div>
      {rows.length === 0 && (
        <p class="text-sm text-muted">
          {services.length < 2 ? 'Add another service to declare dependencies.' : 'No dependencies.'}
        </p>
      )}
      {rows.map((row, index) => (
        <div key={row.id} class="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Select
            label={`Dependency ${index + 1} service`}
            hideLabel
            value={row.service}
            options={services.map((service) => ({ value: service.name, label: service.name || '(unnamed)' }))}
            onValue={(service) => update(row.id, { service })}
          />
          <Select
            label={`Dependency ${index + 1} condition`}
            hideLabel
            value={row.condition}
            options={DEPENDS_OPTIONS}
            onValue={(condition) => update(row.id, { condition })}
          />
          <Button
            class="min-h-9 px-2 py-1 text-xs"
            aria-label={`Remove dependency ${index + 1}`}
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
          >
            Remove
          </Button>
        </div>
      ))}
    </section>
  );
}

export default function DockerComposeBuilderTool() {
  const [config, setConfig] = useState<ComposeConfig>(createDefaultConfig);
  const [selectedId, setSelectedId] = useState(() => config.services[0]!.id);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string>();
  const [importNotice, setImportNotice] = useState<string>();
  const debounced = useDebounced(config, 150);
  const result = useMemo(() => runTool(() => buildCompose(debounced)), [debounced]);
  const output = result.output?.text ?? '';
  const warnings = result.output?.warnings ?? [];
  const selected = config.services.find((service) => service.id === selectedId) ?? config.services[0]!;

  const updateService = (id: string, patch: Partial<ServiceConfig>) => {
    setConfig((previous) => ({
      ...previous,
      services: previous.services.map((service) => (service.id === id ? { ...service, ...patch } : service)),
    }));
  };
  const updateSelected = (patch: Partial<ServiceConfig>) => updateService(selected.id, patch);
  const updateVolume = (id: string, patch: Partial<VolumeConfig>) => {
    setConfig((previous) => ({
      ...previous,
      volumes: previous.volumes.map((volume) => (volume.id === id ? { ...volume, ...patch } : volume)),
    }));
  };
  const updateNetwork = (id: string, patch: Partial<NetworkConfig>) => {
    setConfig((previous) => ({
      ...previous,
      networks: previous.networks.map((network) => (network.id === id ? { ...network, ...patch } : network)),
    }));
  };

  const addService = () => {
    const names = new Set(config.services.map((service) => service.name));
    let number = 2;
    while (names.has(`service${number}`)) number++;
    const service = createService(nextId(config.services, 'service'), `service${number}`);
    setConfig((previous) => ({ ...previous, services: [...previous.services, service] }));
    setSelectedId(service.id);
  };
  const duplicateService = () => {
    const names = new Set(config.services.map((service) => service.name));
    const base = selected.name.trim() || 'service';
    let name = `${base}-copy`;
    let number = 2;
    while (names.has(name)) name = `${base}-copy${number++}`;
    const copy: ServiceConfig = {
      ...selected,
      id: nextId(config.services, 'service'),
      name,
      environment: selected.environment.map((row) => ({ ...row })),
      dependsOn: selected.dependsOn.map((row) => ({ ...row })),
      networks: [...selected.networks],
    };
    setConfig((previous) => ({ ...previous, services: [...previous.services, copy] }));
    setSelectedId(copy.id);
  };
  const removeService = () => {
    if (config.services.length === 1) return;
    const index = config.services.findIndex((service) => service.id === selected.id);
    const services = config.services.filter((service) => service.id !== selected.id);
    setConfig((previous) => ({ ...previous, services }));
    setSelectedId(services[Math.min(Math.max(index, 0), services.length - 1)]!.id);
  };
  const reset = () => {
    const fresh = createDefaultConfig();
    setConfig(fresh);
    setSelectedId(fresh.services[0]!.id);
    setImportError(undefined);
    setImportNotice(undefined);
  };
  const importCompose = () => {
    const imported = runTool(() => parseComposeYaml(importText));
    if (!imported.output) {
      setImportError(imported.error);
      setImportNotice(undefined);
      return;
    }
    setConfig(imported.output);
    setSelectedId(imported.output.services[0]!.id);
    setImportError(undefined);
    setImportNotice(
      `Imported ${imported.output.services.length} service${imported.output.services.length === 1 ? '' : 's'}. The form has been replaced.`,
    );
  };

  const networkChoices = [
    ...new Set([...config.networks.map((network) => network.name.trim()), ...selected.networks]),
  ].filter(Boolean);

  return (
    <div class="grid items-start gap-6 md:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-6">
        <section aria-label="Services" class="flex flex-col gap-3">
          <h2 class="text-lg font-semibold">Services</h2>
          <div class="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={addService}>
              Add service
            </Button>
            <Button onClick={duplicateService}>Duplicate</Button>
            <Button onClick={removeService} disabled={config.services.length === 1}>
              Remove
            </Button>
            <Button onClick={reset}>Reset</Button>
          </div>
          <Tabs
            label="Services"
            tabs={config.services.map((service) => ({ id: service.id, label: service.name || '(unnamed)' }))}
            value={selected.id}
            onValue={setSelectedId}
          >
            <div class="flex flex-col gap-4 pt-1">
              <div class="flex flex-col gap-2">
                <Input
                  label="Image"
                  type="text"
                  value={selected.image}
                  onValue={(image) => updateSelected({ image })}
                  placeholder="nginx:1.27"
                  hint="Required unless a build context or dockerfile is set. Image and build may be used together."
                  data-xt="input"
                />
                <ExampleButton examples={meta.examples} onPick={(image) => updateSelected({ image })} />
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <Input label="Service name" value={selected.name} onValue={(name) => updateSelected({ name })} />
                <Input
                  label="Container name"
                  value={selected.containerName}
                  onValue={(containerName) => updateSelected({ containerName })}
                />
                <Input
                  label="Build context"
                  value={selected.buildContext}
                  onValue={(buildContext) => updateSelected({ buildContext })}
                  placeholder="./app"
                />
                <Input
                  label="Dockerfile"
                  value={selected.buildDockerfile}
                  onValue={(buildDockerfile) => updateSelected({ buildDockerfile })}
                  placeholder="Dockerfile"
                />
                <Select
                  label="Restart policy"
                  value={selected.restart}
                  options={RESTART_OPTIONS}
                  onValue={(restart) => updateSelected({ restart })}
                />
                <Input
                  label="Hostname"
                  value={selected.hostname}
                  onValue={(hostname) => updateSelected({ hostname })}
                />
                <Input
                  label="Working directory"
                  value={selected.workingDir}
                  onValue={(workingDir) => updateSelected({ workingDir })}
                />
                <Input label="User" value={selected.user} onValue={(user) => updateSelected({ user })} />
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <TextArea
                  label="Ports"
                  value={selected.ports}
                  onValue={(ports) => updateSelected({ ports })}
                  rows={3}
                  placeholder={'8080:80\n127.0.0.1:5353:53/udp'}
                  hint="One per line. A single container port is also allowed."
                />
                <TextArea
                  label="Expose"
                  value={selected.expose}
                  onValue={(expose) => updateSelected({ expose })}
                  rows={3}
                  placeholder="80"
                  hint="Optional container ports, one per line."
                />
              </div>
              <TextArea
                label="Volumes"
                value={selected.volumes}
                onValue={(volumes) => updateSelected({ volumes })}
                rows={3}
                placeholder={'./data:/data\ndbdata:/var/lib/postgresql/data:ro'}
                hint="One short-syntax mount per line. Undeclared named volumes are declared automatically."
              />
              <EnvironmentEditor
                rows={selected.environment}
                onChange={(environment) => updateSelected({ environment })}
              />
              <TextArea
                label="Environment files"
                value={selected.envFile}
                onValue={(envFile) => updateSelected({ envFile })}
                rows={2}
                placeholder={'.env\n./config/app.env'}
              />
              <div class="grid gap-4 sm:grid-cols-2">
                <TextArea
                  label="Command"
                  value={selected.command}
                  onValue={(command) => updateSelected({ command })}
                  rows={2}
                  hint="Emitted as a string. Imported lists are shell-joined; quoting is best-effort."
                />
                <TextArea
                  label="Entrypoint"
                  value={selected.entrypoint}
                  onValue={(entrypoint) => updateSelected({ entrypoint })}
                  rows={2}
                  hint="Emitted as a string. Imported lists are shell-joined; quoting is best-effort."
                />
              </div>
              <DependsEditor
                rows={selected.dependsOn}
                services={config.services}
                currentService={selected.id}
                onChange={(dependsOn) => updateSelected({ dependsOn })}
              />
              <fieldset class="flex flex-col gap-2 rounded-lg border border-border p-3">
                <legend class="px-1 text-sm font-semibold">Networks</legend>
                {networkChoices.length === 0 ? (
                  <p class="text-sm text-muted">Declare networks in the Project section, then select them here.</p>
                ) : (
                  <div class="flex flex-wrap gap-x-4 gap-y-2">
                    {networkChoices.map((name) => (
                      <label key={name} class="inline-flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.networks.includes(name)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            updateSelected({
                              networks: checked
                                ? [...selected.networks.filter((network) => network !== name), name]
                                : selected.networks.filter((network) => network !== name),
                            });
                          }}
                          class="size-4 accent-accent"
                        />
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              <TextArea
                label="Additional service YAML"
                value={selected.extra}
                onValue={(extra) => updateSelected({ extra })}
                rows={5}
                placeholder={'privileged: true\nhealthcheck:\n  test: ["CMD", "curl", "-f", "http://localhost"]'}
                hint="A mapping for other Compose keys. Keys managed by the form cannot be repeated here."
              />
            </div>
          </Tabs>
        </section>

        <section aria-label="Project" class="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <h2 class="text-lg font-semibold">Project</h2>
          <Input
            label="Project name (optional)"
            value={config.name}
            onValue={(name) => setConfig((previous) => ({ ...previous, name }))}
          />
          <section aria-label="Declared volumes" class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">Declared volumes</h3>
              <Button
                class="min-h-7 px-2 py-0.5 text-xs"
                onClick={() =>
                  setConfig((previous) => ({
                    ...previous,
                    volumes: [
                      ...previous.volumes,
                      { id: nextId(previous.volumes, 'volume'), name: '', external: false, extra: '' },
                    ],
                  }))
                }
              >
                Add volume
              </Button>
            </div>
            {config.volumes.length === 0 && <p class="text-sm text-muted">No declared volumes.</p>}
            {config.volumes.map((volume, index) => (
              <div
                key={volume.id}
                class="grid items-end gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_auto_auto]"
              >
                <Input
                  label={`Volume ${index + 1} name`}
                  value={volume.name}
                  onValue={(name) => updateVolume(volume.id, { name })}
                />
                <Toggle
                  label={`External (${volume.name || `volume ${index + 1}`})`}
                  checked={volume.external}
                  onChecked={(external) => updateVolume(volume.id, { external })}
                />
                <Button
                  class="min-h-9 px-2 py-1 text-xs"
                  aria-label={`Remove declared volume ${index + 1}`}
                  onClick={() =>
                    setConfig((previous) => ({
                      ...previous,
                      volumes: previous.volumes.filter((item) => item.id !== volume.id),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </section>
          <section aria-label="Declared networks" class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">Declared networks</h3>
              <Button
                class="min-h-7 px-2 py-0.5 text-xs"
                onClick={() =>
                  setConfig((previous) => ({
                    ...previous,
                    networks: [
                      ...previous.networks,
                      {
                        id: nextId(previous.networks, 'network'),
                        name: '',
                        external: false,
                        driver: '',
                        extra: '',
                      },
                    ],
                  }))
                }
              >
                Add network
              </Button>
            </div>
            {config.networks.length === 0 && <p class="text-sm text-muted">No declared networks.</p>}
            {config.networks.map((network, index) => (
              <div key={network.id} class="flex flex-col gap-3 rounded-md border border-border p-3">
                <div class="grid items-end gap-2 sm:grid-cols-2">
                  <Input
                    label={`Network ${index + 1} name`}
                    value={network.name}
                    onValue={(name) => updateNetwork(network.id, { name })}
                  />
                  <Input
                    label={`Network ${index + 1} driver (optional)`}
                    value={network.driver}
                    onValue={(driver) => updateNetwork(network.id, { driver })}
                  />
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <Toggle
                    label={`External (${network.name || `network ${index + 1}`})`}
                    checked={network.external}
                    onChecked={(external) => updateNetwork(network.id, { external })}
                  />
                  <Button
                    class="min-h-9 px-2 py-1 text-xs"
                    aria-label={`Remove declared network ${index + 1}`}
                    onClick={() =>
                      setConfig((previous) => ({
                        ...previous,
                        networks: previous.networks.filter((item) => item.id !== network.id),
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </section>
          <TextArea
            label="Additional top-level YAML"
            value={config.extra}
            onValue={(extra) => setConfig((previous) => ({ ...previous, extra }))}
            rows={5}
            placeholder={'secrets:\n  app_secret:\n    file: ./secret.txt'}
            hint="Advanced top-level keys such as secrets and configs. Do not repeat name, services, volumes or networks."
          />
        </section>

        <details class="rounded-lg border border-border bg-surface p-4">
          <summary class="cursor-pointer text-sm font-semibold">Import compose.yaml</summary>
          <div class="mt-4 flex flex-col gap-3">
            <TextArea
              label="Existing compose.yaml"
              value={importText}
              onValue={setImportText}
              rows={10}
              placeholder={'services:\n  web:\n    image: nginx:1.27'}
              hint="Single-document YAML only. Import replaces the form only after the whole file validates."
            />
            <p class="text-xs text-muted">
              Command and entrypoint lists are shell-joined on import; quoting is best-effort. Unrecognized keys are
              kept in the additional YAML fields.
            </p>
            <div>
              <Button variant="primary" onClick={importCompose}>
                Import
              </Button>
            </div>
            <ErrorMessage message={importError} />
            {importNotice && (
              <p role="status" class="rounded-lg bg-surface p-2 text-sm text-success">
                {importNotice}
              </p>
            )}
          </div>
        </details>
      </div>

      <OutputRegion label="Generated compose.yaml">
        <TextArea label="compose.yaml" value={output} readOnly rows={26} data-xt="output" />
        <span class="sr-only">{output}</span>
        <div class="flex flex-wrap items-center gap-2">
          <CopyButton text={output} ariaLabel="Copy compose.yaml" />
          <DownloadButton data={output} filename="compose.yaml" mime="text/yaml" />
        </div>
        <ErrorMessage message={result.error} />
        {warnings.length > 0 && (
          <section aria-label="Generation warnings" class="flex flex-col gap-1">
            <h2 class="text-sm font-semibold">Warnings</h2>
            <ul class="flex flex-col gap-1 text-sm" data-xt="warnings">
              {warnings.map((warning, index) => (
                <li key={index} class="rounded-md bg-warning-bg px-2 py-1 text-warning">
                  {warning}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p class="text-xs text-muted">
          Compose interpolates <code>$VARIABLE</code>; use <code>$$</code> for a literal dollar sign. This file is
          generated locally in your browser.
        </p>
      </OutputRegion>
    </div>
  );
}
