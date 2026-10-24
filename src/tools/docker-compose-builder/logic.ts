import { Document as YamlDocument, Scalar, isScalar, isSeq, parseAllDocuments, visit } from 'yaml';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const SERVICE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const NAMED_VOLUME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SPECIAL_NETWORKS = new Set(['default', 'host', 'none']);
const RESTART_POLICIES = new Set(['', 'no', 'always', 'on-failure', 'unless-stopped']);
const DEPENDS_CONDITIONS = new Set(['service_started', 'service_healthy', 'service_completed_successfully']);
const QUOTED_LISTS = new Set(['ports', 'expose']);

type Obj = Record<string, unknown>;

export type RestartPolicy = '' | 'no' | 'always' | 'on-failure' | 'unless-stopped';
export type DependsCondition = 'service_started' | 'service_healthy' | 'service_completed_successfully';

export interface EnvironmentRow {
  id: string;
  key: string;
  value: string;
}

export interface DependsOnRow {
  id: string;
  service: string;
  condition: DependsCondition;
  /** Additional imported long-form options, preserved as a YAML mapping. */
  extra?: string;
}

export interface ServiceConfig {
  id: string;
  name: string;
  image: string;
  buildContext: string;
  buildDockerfile: string;
  /** Additional imported build keys, preserved as a YAML mapping. */
  buildExtra?: string;
  containerName: string;
  restart: RestartPolicy;
  ports: string;
  expose: string;
  volumes: string;
  environment: EnvironmentRow[];
  envFile: string;
  command: string;
  entrypoint: string;
  workingDir: string;
  user: string;
  hostname: string;
  dependsOn: DependsOnRow[];
  networks: string[];
  /** Imported per-network attachment options, keyed by network name. */
  networkOptions?: string;
  extra: string;
}

export interface VolumeConfig {
  id: string;
  name: string;
  external: boolean;
  /** Additional imported declaration keys, preserved as a YAML mapping. */
  extra?: string;
}

export interface NetworkConfig {
  id: string;
  name: string;
  external: boolean;
  driver: string;
  /** Additional imported declaration keys, preserved as a YAML mapping. */
  extra?: string;
}

export interface ComposeConfig {
  name: string;
  services: ServiceConfig[];
  volumes: VolumeConfig[];
  networks: NetworkConfig[];
  extra: string;
}

export interface ComposeResult {
  text: string;
  warnings: string[];
}

const MANAGED_SERVICE_KEYS = new Set([
  'image',
  'build',
  'container_name',
  'restart',
  'ports',
  'expose',
  'volumes',
  'environment',
  'env_file',
  'command',
  'entrypoint',
  'working_dir',
  'user',
  'hostname',
  'depends_on',
  'networks',
]);
const MANAGED_TOP_KEYS = new Set(['name', 'services', 'volumes', 'networks', 'version']);

const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOwn = (value: Obj, key: string): boolean => Object.hasOwn(value, key);
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0]!;

function checkSize(text: string, label = 'Input'): void {
  if (text.length > MAX_INPUT) throw new ToolInputError(`${label} is too large (maximum 1 MB).`);
}

export function createService(id: string, name: string): ServiceConfig {
  return {
    id,
    name,
    image: '',
    buildContext: '',
    buildDockerfile: '',
    buildExtra: '',
    containerName: '',
    restart: '',
    ports: '',
    expose: '',
    volumes: '',
    environment: [],
    envFile: '',
    command: '',
    entrypoint: '',
    workingDir: '',
    user: '',
    hostname: '',
    dependsOn: [],
    networks: [],
    networkOptions: '',
    extra: '',
  };
}

export function createDefaultConfig(): ComposeConfig {
  return { name: '', services: [createService('service-1', 'web')], volumes: [], networks: [], extra: '' };
}

/** Parses one YAML document and converts aliases with a bounded expansion. */
function parseSingleYaml(text: string, label: string): unknown {
  checkSize(text, label);
  let documents: ReturnType<typeof parseAllDocuments>;
  try {
    documents = parseAllDocuments(text, { merge: true, prettyErrors: true });
  } catch (error) {
    throw new ToolInputError(`Invalid ${label}: ${errorText(error)}`);
  }
  if (documents.length !== 1) throw new ToolInputError(`${label} must contain exactly one YAML document.`);
  const doc = documents[0]!;
  if (doc.errors.length > 0) throw new ToolInputError(`Invalid ${label}: ${errorText(doc.errors[0])}`);
  try {
    return doc.toJS({ maxAliasCount: 100 }) as unknown;
  } catch (error) {
    throw new ToolInputError(`Invalid ${label}: ${errorText(error)}`);
  }
}

function parseMapping(text: string, label: string): Obj {
  if (text.trim() === '') return {};
  const value = parseSingleYaml(text, label);
  if (!isObj(value)) throw new ToolInputError(`${label} must be a YAML mapping, not an array or scalar.`);
  return value;
}

function assertNoManagedKeys(extra: Obj, managed: ReadonlySet<string>, label: string): void {
  for (const key of Object.keys(extra)) {
    if (managed.has(key)) {
      throw new ToolInputError(`${label} contains managed key "${key}"; use the corresponding form field instead.`);
    }
  }
}

function yamlText(value: unknown): string {
  try {
    const doc = new YamlDocument(value, { version: '1.1' });
    visit(doc, {
      Pair(_key, pair) {
        if (isScalar(pair.key) && QUOTED_LISTS.has(String(pair.key.value)) && isSeq(pair.value)) {
          for (const item of pair.value.items) {
            if (isScalar(item)) {
              item.value = String(item.value);
              item.type = Scalar.QUOTE_DOUBLE;
            }
          }
        }
      },
    });
    return doc.toString({ lineWidth: 0 });
  } catch (error) {
    throw new ToolInputError(`Could not generate YAML: ${errorText(error)}`);
  }
}

function serializeExtra(value: Obj): string {
  return Object.keys(value).length === 0 ? '' : yamlText(value).trimEnd();
}

function nonEmptyLines(text: string, label: string): Array<{ value: string; line: number }> {
  checkSize(text, label);
  const out: Array<{ value: string; line: number }> = [];
  const lines = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const value = lines[i]!.trim();
    if (value) out.push({ value, line: i + 1 });
  }
  return out;
}

function validPortToken(value: string): boolean {
  const match = /^(\d+)(?:-(\d+))?$/.exec(value);
  if (!match) return false;
  const first = Number(match[1]);
  const last = match[2] === undefined ? first : Number(match[2]);
  return first >= 1 && last <= 65535 && first <= last;
}

function validProtocol(value: string): boolean {
  return ['tcp', 'udp', 'sctp'].includes(value.toLowerCase());
}

function splitProtocol(value: string): { body: string; protocol?: string } {
  const slash = value.lastIndexOf('/');
  if (slash < 0) return { body: value };
  const protocol = value.slice(slash + 1);
  return { body: value.slice(0, slash), protocol };
}

/** Parses and pragmatically validates Compose short-syntax port lines. */
export function parsePorts(text: string): string[] {
  return nonEmptyLines(text, 'Ports').map(({ value, line }) => {
    const fail = (): never => {
      throw new ToolInputError(
        `Invalid port on line ${line}: "${value}". Use 80, 8080:80 or 127.0.0.1:8080:80, optionally followed by /udp.`,
      );
    };
    const { body, protocol } = splitProtocol(value);
    if ((protocol !== undefined && !validProtocol(protocol)) || body.includes('/')) fail();

    let published: string | undefined;
    let target: string | undefined;
    if (body.startsWith('[')) {
      const close = body.indexOf(']');
      if (close < 0 || !/^[0-9A-Fa-f:.]+$/.test(body.slice(1, close))) fail();
      const rest = body.slice(close + 1);
      const parts = rest.startsWith(':') ? rest.slice(1).split(':') : [];
      if (parts.length !== 2) fail();
      [published, target] = parts;
    } else {
      const parts = body.split(':');
      if (parts.length === 1) [target] = parts;
      else if (parts.length === 2) [published, target] = parts;
      else if (parts.length === 3) {
        const host = parts[0]!;
        if (!/^[A-Za-z0-9_.-]+$/.test(host)) fail();
        published = parts[1];
        target = parts[2];
      } else fail();
    }
    if (target === undefined || !validPortToken(target) || (published !== undefined && !validPortToken(published))) {
      fail();
    }
    return value;
  });
}

function parseExpose(text: string): string[] {
  return nonEmptyLines(text, 'Expose').map(({ value, line }) => {
    const { body, protocol } = splitProtocol(value);
    if (
      body.includes(':') ||
      body.includes('/') ||
      !validPortToken(body) ||
      (protocol !== undefined && !validProtocol(protocol))
    ) {
      throw new ToolInputError(
        `Invalid exposed port on line ${line}: "${value}". Use a container port such as 80 or 53/udp.`,
      );
    }
    return value;
  });
}

function validVolumeMode(value: string): boolean {
  return value.split(',').every((part) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(part));
}

interface VolumeEntry {
  text: string;
  namedSource?: string;
}

function parseVolumeEntry(value: string, line: number): VolumeEntry {
  const fail = (): never => {
    throw new ToolInputError(
      `Invalid volume on line ${line}: "${value}". Use /container/path, source:/container/path or source:/container/path:ro.`,
    );
  };
  if (value.includes('\0')) fail();

  // A colon in a Windows drive letter is part of the source, not a separator.
  const drive = /^[A-Za-z]:[\\/]/.test(value) ? 2 : 0;
  const colon = value.indexOf(':', drive);
  if (colon < 0) {
    if (value.startsWith('/')) return { text: value };
    fail();
  }

  const source = value.slice(0, colon);
  const parts = value.slice(colon + 1).split(':');
  // Anonymous volumes can also have a mode: /data:ro.
  if (source.startsWith('/') && parts.every((part) => !part.startsWith('/')) && parts.every(validVolumeMode)) {
    return { text: value };
  }
  if (!source || parts.length < 1 || parts.length > 2) fail();
  const target = parts[0]!;
  const mode = parts[1];
  if (!target.startsWith('/') || (mode !== undefined && !validVolumeMode(mode))) fail();
  const namedSource = NAMED_VOLUME.test(source) ? source : undefined;
  return { text: value, ...(namedSource ? { namedSource } : {}) };
}

function parseVolumeEntries(text: string): VolumeEntry[] {
  return nonEmptyLines(text, 'Volumes').map(({ value, line }) => parseVolumeEntry(value, line));
}

/** Parses and pragmatically validates Compose short-syntax volume lines. */
export function parseVolumes(text: string): string[] {
  return parseVolumeEntries(text).map((entry) => entry.text);
}

function serviceName(name: string, index: number): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ToolInputError(`Service ${index + 1} has an empty name.`);
  if (!SERVICE_NAME.test(trimmed)) {
    throw new ToolInputError(
      `Invalid service name "${trimmed}". Use letters, digits, "_", "." or "-", and start with a letter or digit.`,
    );
  }
  return trimmed;
}

function resourceName(name: string, kind: 'volume' | 'network'): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ToolInputError(`A declared ${kind} has an empty name.`);
  if (!SERVICE_NAME.test(trimmed)) throw new ToolInputError(`Invalid ${kind} name "${trimmed}".`);
  return trimmed;
}

interface BuiltService {
  name: string;
  definition: Obj;
  namedVolumes: string[];
  networks: string[];
}

function buildService(service: ServiceConfig, index: number, allNames: ReadonlySet<string>): BuiltService {
  const name = serviceName(service.name, index);
  try {
    if (!RESTART_POLICIES.has(service.restart)) {
      throw new ToolInputError(`Invalid restart policy "${String(service.restart)}".`);
    }
    const image = service.image.trim();
    const context = service.buildContext.trim();
    const dockerfile = service.buildDockerfile.trim();
    const buildExtra = parseMapping(service.buildExtra ?? '', 'Additional build YAML');
    assertNoManagedKeys(buildExtra, new Set(['context', 'dockerfile']), 'Additional build YAML');
    const hasBuild = Boolean(context || dockerfile || Object.keys(buildExtra).length);
    if (!image && !hasBuild) throw new ToolInputError('Set an image or a build context/dockerfile.');

    const extra = parseMapping(service.extra, 'Additional service YAML');
    assertNoManagedKeys(extra, MANAGED_SERVICE_KEYS, 'Additional service YAML');
    const entries: Array<[string, unknown]> = [];
    if (image) entries.push(['image', image]);
    if (hasBuild) {
      if (!dockerfile && Object.keys(buildExtra).length === 0) entries.push(['build', context]);
      else {
        entries.push([
          'build',
          Object.fromEntries([
            ['context', context || '.'] as [string, unknown],
            ...(dockerfile ? ([['dockerfile', dockerfile]] as Array<[string, unknown]>) : []),
            ...Object.entries(buildExtra),
          ]),
        ]);
      }
    }

    const simpleFields: Array<[string, string]> = [
      ['container_name', service.containerName.trim()],
      ['restart', service.restart],
    ];
    for (const [key, value] of simpleFields) if (value) entries.push([key, value]);

    const ports = parsePorts(service.ports);
    if (ports.length) entries.push(['ports', ports]);
    const expose = parseExpose(service.expose);
    if (expose.length) entries.push(['expose', expose]);
    const volumes = parseVolumeEntries(service.volumes);
    if (volumes.length) entries.push(['volumes', volumes.map((volume) => volume.text)]);

    const environment: Array<[string, unknown]> = [];
    const environmentKeys = new Set<string>();
    for (const row of service.environment) {
      const key = row.key.trim();
      if (!key) throw new ToolInputError('Environment variable names cannot be empty.');
      if (key.includes('=')) throw new ToolInputError(`Environment variable name "${key}" cannot contain "=".`);
      if (environmentKeys.has(key)) throw new ToolInputError(`Duplicate environment variable "${key}".`);
      environmentKeys.add(key);
      environment.push([key, row.value]);
    }
    if (environment.length) entries.push(['environment', Object.fromEntries(environment)]);

    const envFile = nonEmptyLines(service.envFile, 'Env file').map((entry) => entry.value);
    if (envFile.length) entries.push(['env_file', envFile]);
    for (const [key, value] of [
      ['command', service.command],
      ['entrypoint', service.entrypoint],
      ['working_dir', service.workingDir.trim()],
      ['user', service.user.trim()],
      ['hostname', service.hostname.trim()],
    ] as Array<[string, string]>) {
      if (value.trim()) entries.push([key, value]);
    }

    const dependencies: Array<[string, DependsOnRow]> = [];
    const dependencyNames = new Set<string>();
    let longDependencies = false;
    for (const row of service.dependsOn) {
      const dependency = row.service.trim();
      if (!dependency) throw new ToolInputError('A depends_on row has an empty service name.');
      if (dependency === name) throw new ToolInputError(`A service cannot depend on itself ("${dependency}").`);
      if (!allNames.has(dependency)) throw new ToolInputError(`depends_on refers to unknown service "${dependency}".`);
      if (dependencyNames.has(dependency)) throw new ToolInputError(`Duplicate depends_on row for "${dependency}".`);
      if (!DEPENDS_CONDITIONS.has(row.condition)) {
        throw new ToolInputError(`Invalid depends_on condition "${String(row.condition)}" for "${dependency}".`);
      }
      dependencyNames.add(dependency);
      const dependencyExtra = parseMapping(row.extra ?? '', `Additional depends_on YAML for "${dependency}"`);
      assertNoManagedKeys(dependencyExtra, new Set(['condition']), `Additional depends_on YAML for "${dependency}"`);
      if (row.condition !== 'service_started' || Object.keys(dependencyExtra).length > 0) longDependencies = true;
      dependencies.push([dependency, row]);
    }
    if (dependencies.length) {
      if (!longDependencies) entries.push(['depends_on', dependencies.map(([dependency]) => dependency)]);
      else {
        entries.push([
          'depends_on',
          Object.fromEntries(
            dependencies.map(([dependency, row]) => [
              dependency,
              Object.fromEntries([
                ['condition', row.condition] as [string, unknown],
                ...Object.entries(parseMapping(row.extra ?? '', `Additional depends_on YAML for "${dependency}"`)),
              ]),
            ]),
          ),
        ]);
      }
    }

    const networks = [...new Set(service.networks.map((network) => network.trim()).filter(Boolean))];
    for (const network of networks) {
      if (!SERVICE_NAME.test(network)) throw new ToolInputError(`Invalid network name "${network}".`);
    }
    const networkOptions = parseMapping(service.networkOptions ?? '', 'Additional network attachment YAML');
    if (networks.length) {
      const hasOptions = networks.some((network) => {
        if (!hasOwn(networkOptions, network)) return false;
        const options = networkOptions[network];
        return options !== null && (!isObj(options) || Object.keys(options).length > 0);
      });
      entries.push([
        'networks',
        hasOptions
          ? Object.fromEntries(
              networks.map((network) => [network, hasOwn(networkOptions, network) ? networkOptions[network] : null]),
            )
          : networks,
      ]);
    }

    entries.push(...Object.entries(extra));
    return {
      name,
      definition: Object.fromEntries(entries),
      namedVolumes: volumes.flatMap((volume) => (volume.namedSource ? [volume.namedSource] : [])),
      networks,
    };
  } catch (error) {
    if (error instanceof ToolInputError) throw new ToolInputError(`Service "${name}": ${error.message}`);
    throw error;
  }
}

function resourceDefinition(resource: VolumeConfig | NetworkConfig, kind: 'volume' | 'network'): [string, Obj] {
  const name = resourceName(resource.name, kind);
  const extra = parseMapping(resource.extra ?? '', `Additional ${kind} YAML for "${name}"`);
  assertNoManagedKeys(
    extra,
    kind === 'network' ? new Set(['external', 'driver']) : new Set(['external']),
    `Additional ${kind} YAML for "${name}"`,
  );
  const entries: Array<[string, unknown]> = [];
  if (resource.external) entries.push(['external', true]);
  if (kind === 'network' && 'driver' in resource && resource.driver.trim()) {
    entries.push(['driver', resource.driver.trim()]);
  }
  entries.push(...Object.entries(extra));
  return [name, Object.fromEntries(entries)];
}

/** Builds a compose.yaml from the form state. All validation errors are user-facing. */
export function buildCompose(config: ComposeConfig): ComposeResult {
  if (config.services.length === 0) throw new ToolInputError('At least one service is required.');
  const names = config.services.map((service, index) => serviceName(service.name, index));
  const allNames = new Set<string>();
  for (const name of names) {
    if (allNames.has(name)) throw new ToolInputError(`Duplicate service name "${name}".`);
    allNames.add(name);
  }

  const topExtra = parseMapping(config.extra, 'Additional top-level YAML');
  for (const key of Object.keys(topExtra)) {
    if (key === 'version') {
      throw new ToolInputError('The obsolete top-level "version" key is not emitted; remove it from additional YAML.');
    }
  }
  assertNoManagedKeys(topExtra, new Set(['name', 'services', 'volumes', 'networks']), 'Additional top-level YAML');

  const volumeEntries: Array<[string, unknown]> = [];
  const declaredVolumes = new Set<string>();
  for (const volume of config.volumes) {
    const [name, definition] = resourceDefinition(volume, 'volume');
    if (declaredVolumes.has(name)) throw new ToolInputError(`Duplicate declared volume "${name}".`);
    declaredVolumes.add(name);
    volumeEntries.push([name, definition]);
  }
  const networkEntries: Array<[string, unknown]> = [];
  const declaredNetworks = new Set<string>();
  for (const network of config.networks) {
    const [name, definition] = resourceDefinition(network, 'network');
    if (declaredNetworks.has(name)) throw new ToolInputError(`Duplicate declared network "${name}".`);
    declaredNetworks.add(name);
    networkEntries.push([name, definition]);
  }

  const built = config.services.map((service, index) => buildService(service, index, allNames));
  const warnings: string[] = [];
  const autoVolumes = new Set<string>();
  const autoNetworks = new Set<string>();
  for (const service of built) {
    for (const volume of service.namedVolumes) {
      if (!declaredVolumes.has(volume)) autoVolumes.add(volume);
    }
    for (const network of service.networks) {
      if (SPECIAL_NETWORKS.has(network)) {
        warnings.push(
          network === 'default'
            ? `Service "${service.name}" selects the special "default" network; it is not auto-declared.`
            : `Service "${service.name}" selects "${network}" as a network. Use network_mode in additional service YAML for ${network} mode; it is not auto-declared.`,
        );
      } else if (!declaredNetworks.has(network)) autoNetworks.add(network);
    }
  }
  if (autoVolumes.size) {
    const list = [...autoVolumes].sort();
    warnings.push(`Auto-declared named volume${list.length === 1 ? '' : 's'}: ${list.join(', ')}.`);
    for (const name of list) volumeEntries.push([name, {}]);
  }
  if (autoNetworks.size) {
    const list = [...autoNetworks].sort();
    warnings.push(`Auto-declared network${list.length === 1 ? '' : 's'}: ${list.join(', ')}.`);
    for (const name of list) networkEntries.push([name, {}]);
  }

  const root: Array<[string, unknown]> = [];
  if (config.name.trim()) root.push(['name', config.name.trim()]);
  root.push(['services', Object.fromEntries(built.map((service) => [service.name, service.definition]))]);
  if (volumeEntries.length) root.push(['volumes', Object.fromEntries(volumeEntries)]);
  if (networkEntries.length) root.push(['networks', Object.fromEntries(networkEntries)]);
  root.push(...Object.entries(topExtra));
  return { text: yamlText(Object.fromEntries(root)), warnings };
}

// ---------------------------------------------------------------------------
// Compose YAML import

function scalarText(value: unknown, path: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  throw new ToolInputError(`"${path}" must contain only scalar values.`);
}

function optionalString(source: Obj, key: string, path: string): string {
  const value = source[key];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ToolInputError(`"${path}.${key}" must be a string.`);
  return value;
}

function stringLines(value: unknown, path: string): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map((item, index) => scalarText(item, `${path}[${index}]`)).join('\n');
  return scalarText(value, path);
}

function shellWord(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function commandText(value: unknown, path: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) throw new ToolInputError(`"${path}" must be a string or a list.`);
  return value.map((item, index) => shellWord(scalarText(item, `${path}[${index}]`))).join(' ');
}

function importEnvironment(value: unknown, service: string, prefix: string): EnvironmentRow[] {
  const path = `services.${service}.environment`;
  if (value === undefined || value === null) return [];
  if (isObj(value)) {
    return Object.entries(value).map(([key, raw], index) => ({
      id: `${prefix}-env-${index + 1}`,
      key,
      value: raw === null ? '' : scalarText(raw, `${path}.${key}`),
    }));
  }
  if (!Array.isArray(value)) throw new ToolInputError(`"${path}" must be a mapping or a list.`);
  return value.map((raw, index) => {
    const text = scalarText(raw, `${path}[${index}]`);
    const equals = text.indexOf('=');
    return {
      id: `${prefix}-env-${index + 1}`,
      key: equals < 0 ? text : text.slice(0, equals),
      value: equals < 0 ? '' : text.slice(equals + 1),
    };
  });
}

function extraWithout(source: Obj, managed: ReadonlySet<string>): string {
  return serializeExtra(Object.fromEntries(Object.entries(source).filter(([key]) => !managed.has(key))));
}

function importDependsOn(value: unknown, service: string, prefix: string): DependsOnRow[] {
  const path = `services.${service}.depends_on`;
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((raw, index) => ({
      id: `${prefix}-depends-${index + 1}`,
      service: scalarText(raw, `${path}[${index}]`),
      condition: 'service_started',
      extra: '',
    }));
  }
  if (!isObj(value)) throw new ToolInputError(`"${path}" must be a list or a mapping.`);
  return Object.entries(value).map(([dependency, raw], index) => {
    let condition = 'service_started';
    let extra = '';
    if (raw !== null) {
      if (!isObj(raw)) throw new ToolInputError(`"${path}.${dependency}" must be a mapping or null.`);
      condition = optionalString(raw, 'condition', `${path}.${dependency}`) || 'service_started';
      if (!DEPENDS_CONDITIONS.has(condition)) {
        throw new ToolInputError(`"${path}.${dependency}.condition" has unsupported value "${condition}".`);
      }
      extra = extraWithout(raw, new Set(['condition']));
    }
    return {
      id: `${prefix}-depends-${index + 1}`,
      service: dependency,
      condition: condition as DependsCondition,
      extra,
    };
  });
}

function importServiceNetworks(value: unknown, service: string): { networks: string[]; options: string } {
  const path = `services.${service}.networks`;
  if (value === undefined || value === null) return { networks: [], options: '' };
  if (Array.isArray(value)) {
    return { networks: value.map((item, index) => scalarText(item, `${path}[${index}]`)), options: '' };
  }
  if (!isObj(value)) throw new ToolInputError(`"${path}" must be a list or a mapping.`);
  return { networks: Object.keys(value), options: serializeExtra(value) };
}

function importService(name: string, source: Obj, index: number): ServiceConfig {
  const path = `services.${name}`;
  const id = `service-${index + 1}`;
  const result = createService(id, name);
  result.image = optionalString(source, 'image', path);
  result.containerName = optionalString(source, 'container_name', path);
  result.restart = optionalString(source, 'restart', path) as RestartPolicy;
  if (!RESTART_POLICIES.has(result.restart)) {
    throw new ToolInputError(`"${path}.restart" has unsupported value "${result.restart}".`);
  }

  const build = source.build;
  if (typeof build === 'string') result.buildContext = build;
  else if (build !== undefined && build !== null) {
    if (!isObj(build)) throw new ToolInputError(`"${path}.build" must be a string or a mapping.`);
    result.buildContext = optionalString(build, 'context', `${path}.build`);
    result.buildDockerfile = optionalString(build, 'dockerfile', `${path}.build`);
    result.buildExtra = extraWithout(build, new Set(['context', 'dockerfile']));
  }

  result.ports = stringLines(source.ports, `${path}.ports`);
  result.expose = stringLines(source.expose, `${path}.expose`);
  result.volumes = stringLines(source.volumes, `${path}.volumes`);
  result.envFile = stringLines(source.env_file, `${path}.env_file`);
  result.environment = importEnvironment(source.environment, name, id);
  result.command = commandText(source.command, `${path}.command`);
  result.entrypoint = commandText(source.entrypoint, `${path}.entrypoint`);
  result.workingDir = optionalString(source, 'working_dir', path);
  result.user = optionalString(source, 'user', path);
  result.hostname = optionalString(source, 'hostname', path);
  result.dependsOn = importDependsOn(source.depends_on, name, id);
  const networks = importServiceNetworks(source.networks, name);
  result.networks = networks.networks;
  result.networkOptions = networks.options;
  result.extra = extraWithout(source, MANAGED_SERVICE_KEYS);
  return result;
}

function importResources(value: unknown, kind: 'volume' | 'network'): Array<VolumeConfig | NetworkConfig> {
  const path = kind === 'volume' ? 'volumes' : 'networks';
  if (value === undefined || value === null) return [];
  if (!isObj(value)) throw new ToolInputError(`Top-level "${path}" must be a mapping.`);
  return Object.entries(value).map(([name, raw], index) => {
    const id = `${kind}-${index + 1}`;
    if (raw !== null && !isObj(raw)) {
      throw new ToolInputError(`Top-level "${path}.${name}" must be a mapping, null or an empty declaration.`);
    }
    const definition = raw ?? {};
    const external = definition.external ?? false;
    if (typeof external !== 'boolean') throw new ToolInputError(`"${path}.${name}.external" must be a boolean.`);
    if (kind === 'network') {
      const driver = optionalString(definition, 'driver', `${path}.${name}`);
      return {
        id,
        name,
        external,
        driver,
        extra: extraWithout(definition, new Set(['external', 'driver'])),
      };
    }
    return { id, name, external, extra: extraWithout(definition, new Set(['external'])) };
  });
}

/** Imports one compose.yaml document into the editable form state. */
export function parseComposeYaml(text: string): ComposeConfig {
  const root = parseSingleYaml(text, 'Compose YAML');
  if (!isObj(root)) throw new ToolInputError('A Compose file must be a mapping with a "services:" mapping.');
  if (!isObj(root.services)) {
    throw new ToolInputError('Top-level "services" must be a mapping of service names to definitions.');
  }
  const serviceEntries = Object.entries(root.services);
  if (serviceEntries.length === 0) throw new ToolInputError('The Compose file must define at least one service.');

  const services = serviceEntries.map(([name, definition], index) => {
    serviceName(name, index);
    if (!isObj(definition)) throw new ToolInputError(`Service "${name}" must be a mapping, not an array or scalar.`);
    return importService(name, definition, index);
  });
  const name = root.name === undefined || root.name === null ? '' : optionalString(root, 'name', 'top level');
  const config: ComposeConfig = {
    name,
    services,
    volumes: importResources(root.volumes, 'volume') as VolumeConfig[],
    networks: importResources(root.networks, 'network') as NetworkConfig[],
    // The obsolete version key is deliberately omitted from generated files.
    extra: extraWithout(root, MANAGED_TOP_KEYS),
  };
  // Imported references and short syntax get the same validation as form edits.
  buildCompose(config);
  return config;
}
