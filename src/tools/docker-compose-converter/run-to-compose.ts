// docker run → Compose service definitions.
import { ToolInputError } from '../types.ts';
import { LITERAL_DOLLAR, splitCommands, type ShellCommand } from './shell.ts';

export interface Note {
  level: 'warning' | 'info';
  message: string;
}

type Obj = Record<string, unknown>;

interface NetworkEntry {
  aliases: string[];
  ipv4_address?: string;
  ipv6_address?: string;
  link_local_ips: string[];
}

/** One parsed docker run command, before cross-service references are resolved. */
export interface ParsedService {
  name: string;
  service: Obj;
  networks: Map<string, NetworkEntry>;
  /** Raw `--network` values that select a mode rather than a network. */
  networkMode?: string;
  links: string[];
  volumesFrom: string[];
  namedVolumes: Set<string>;
  notes: Note[];
}

interface Ctx extends ParsedService {
  /** Set once an option has added a note that should only be shown once per service. */
  once: Set<string>;
  pendingAliases: string[];
  pendingIp: { v4?: string; v6?: string; linkLocal: string[] };
}

type Handler = (ctx: Ctx, value: string, flag: string) => void;

interface Option {
  names: string[];
  /** `false` for boolean flags. */
  value: boolean;
  handle: Handler;
}

const isTrue = (v: string) => v !== 'false' && v !== '0';

const set =
  (key: string, convert: (v: string) => unknown = (v) => v): Handler =>
  (ctx, v) => {
    ctx.service[key] = convert(v);
  };
const push =
  (key: string): Handler =>
  (ctx, v) => {
    const list = (ctx.service[key] ??= []) as unknown[];
    list.push(v);
  };
const bool =
  (key: string): Handler =>
  (ctx, v) => {
    if (isTrue(v)) ctx.service[key] = true;
    else delete ctx.service[key];
  };
const mapEntry =
  (key: string): Handler =>
  (ctx, v, flag) => {
    const eq = v.indexOf('=');
    if (eq <= 0) {
      warn(ctx, `${flag} ${v}: expected key=value; skipped.`);
      return;
    }
    const map = (ctx.service[key] ??= {}) as Obj;
    map[v.slice(0, eq)] = v.slice(eq + 1);
  };
const nested = (ctx: Ctx, ...path: string[]): Obj => {
  let o: Obj = ctx.service;
  for (const p of path) o = (o[p] ??= {}) as Obj;
  return o;
};
const unsupported =
  (reason: string): Handler =>
  (ctx, _v, flag) =>
    warn(ctx, `${flag} ${reason}`);
const info =
  (message: string): Handler =>
  (ctx, _v, flag) => {
    if (!ctx.once.has(flag)) ctx.notes.push({ level: 'info', message: `${flag}: ${message}` });
    ctx.once.add(flag);
  };

function warn(ctx: Ctx, message: string) {
  ctx.notes.push({ level: 'warning', message });
}

/** Integers stay numbers in the YAML; anything else (e.g. `$VAR`) stays a string. */
const toInt = (v: string): number | string => (/^-?\d+$/.test(v) ? Number(v) : v);
const toNumber = (v: string): number | string => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);

function healthcheck(key: string, convert: (v: string) => unknown = (v) => v): Handler {
  return (ctx, v) => {
    nested(ctx, 'healthcheck')[key] = convert(v);
  };
}

function blkioDevice(key: string, field: 'rate' | 'weight', numeric: boolean): Handler {
  return (ctx, v, flag) => {
    const colon = v.lastIndexOf(':');
    if (colon <= 0) {
      warn(ctx, `${flag} ${v}: expected path:value; skipped.`);
      return;
    }
    const raw = v.slice(colon + 1);
    const list = (nested(ctx, 'blkio_config')[key] ??= []) as unknown[];
    list.push({ path: v.slice(0, colon), [field]: numeric ? toInt(raw) : raw });
  };
}

/** Parses Docker's CSV option values (`a=b,"c=d,e"`). */
export function splitCsv(value: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') {
      if (quoted && value[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      fields.push(cur);
      cur = '';
    } else cur += c;
  }
  fields.push(cur);
  return fields;
}

/** Replaces `$(pwd)`, `$PWD` and friends at the start of a host path with `.`. */
function relativizePwd(ctx: Ctx, source: string): string {
  const m = /^(\$\(pwd\)|`pwd`|\$\{PWD\}|\$PWD)(?=$|[/:])/.exec(source);
  if (!m) return source;
  if (m[1]!.includes('pwd')) {
    if (!ctx.once.has('pwd'))
      ctx.notes.push({
        level: 'info',
        message: `Replaced ${m[1]} with "." (Compose resolves relative paths from the compose file's folder).`,
      });
    ctx.once.add('pwd');
  }
  return `.${source.slice(m[0].length)}`;
}

const NAMED_VOLUME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function volumeShort(ctx: Ctx, value: string) {
  // A Windows drive letter ("C:\data:/data") contains a colon of its own.
  const drive = /^[A-Za-z]:[\\/]/.test(value) ? 2 : 0;
  const colon = value.indexOf(':', drive);
  if (colon < 0) {
    push('volumes')(ctx, value, '-v');
    return;
  }
  const source = relativizePwd(ctx, value.slice(0, colon));
  if (NAMED_VOLUME.test(source)) ctx.namedVolumes.add(source);
  push('volumes')(ctx, source + value.slice(colon), '-v');
}

function mount(ctx: Ctx, value: string, flag: string) {
  const entry: Obj = {};
  const extra: Obj = {};
  let type = 'volume';
  for (const field of splitCsv(value)) {
    const eq = field.indexOf('=');
    const key = (eq < 0 ? field : field.slice(0, eq)).trim().toLowerCase();
    const val = eq < 0 ? undefined : field.slice(eq + 1);
    switch (key) {
      case 'type':
        type = val ?? 'volume';
        break;
      case 'source':
      case 'src':
        entry.source = val;
        break;
      case 'target':
      case 'destination':
      case 'dst':
        entry.target = val;
        break;
      case 'readonly':
      case 'ro':
        if (val === undefined || isTrue(val)) entry.read_only = true;
        break;
      case 'consistency':
        entry.consistency = val;
        break;
      case 'bind-propagation':
        extra['bind.propagation'] = val;
        break;
      case 'bind-recursive':
        extra['bind.recursive'] = val;
        break;
      case 'volume-nocopy':
        extra['volume.nocopy'] = val === undefined || isTrue(val);
        break;
      case 'volume-subpath':
        extra['volume.subpath'] = val;
        break;
      case 'tmpfs-size':
        extra['tmpfs.size'] = val === undefined ? val : toInt(val);
        break;
      case 'tmpfs-mode':
        extra['tmpfs.mode'] = val === undefined ? val : toInt(val);
        break;
      case 'image-subpath':
        extra['image.subpath'] = val;
        break;
      default:
        warn(ctx, `${flag} option "${key}" has no Compose equivalent; skipped.`);
    }
  }
  if (typeof entry.source === 'string') {
    const source = relativizePwd(ctx, entry.source);
    entry.source = source;
    if (type === 'volume' && NAMED_VOLUME.test(source)) ctx.namedVolumes.add(source);
  }
  const out: Obj = { type, ...entry };
  for (const [path, v] of Object.entries(extra)) {
    if (v === undefined) continue;
    const [group, key] = path.split('.') as [string, string];
    ((out[group] ??= {}) as Obj)[key] = v;
  }
  ((ctx.service.volumes ??= []) as unknown[]).push(out);
}

function ulimit(ctx: Ctx, value: string, flag: string) {
  const m = /^([a-z]+)=(-?\d+)(?::(-?\d+))?$/.exec(value);
  if (!m) {
    warn(ctx, `${flag} ${value}: expected name=soft[:hard]; skipped.`);
    return;
  }
  const map = (ctx.service.ulimits ??= {}) as Obj;
  map[m[1]!] = m[3] === undefined ? Number(m[2]) : { soft: Number(m[2]), hard: Number(m[3]) };
}

function gpus(ctx: Ctx, value: string) {
  const device: Obj = { driver: 'nvidia' };
  let ids: string[] | undefined;
  for (const field of splitCsv(value.replace(/^"(.*)"$/, '$1'))) {
    const eq = field.indexOf('=');
    if (eq < 0) {
      if (field === 'all') device.count = 'all';
      else if (/^\d+$/.test(field) && ids === undefined) device.count = Number(field);
      else if (ids !== undefined) ids.push(field);
      continue;
    }
    const key = field.slice(0, eq);
    const val = field.slice(eq + 1);
    if (key === 'count') device.count = val === 'all' ? 'all' : toInt(val);
    else if (key === 'device') ids = [val];
    else if (key === 'driver') device.driver = val;
    else if (key === 'capabilities') device.capabilities = [val];
  }
  if (ids) device.device_ids = ids;
  device.capabilities ??= ['gpu'];
  const reservations = nested(ctx, 'deploy', 'resources', 'reservations');
  ((reservations.devices ??= []) as unknown[]).push(device);
}

function network(ctx: Ctx, value: string) {
  const [name = ''] = value.split(',');
  // "default" is Docker's default bridge network: nothing to declare.
  if (name === 'default') return;
  if (['host', 'none', 'bridge'].includes(name) || /^(container|service):/.test(name)) {
    ctx.networkMode = name;
    return;
  }
  if (value.includes(',') || value.startsWith('name=')) {
    // Advanced syntax: --network name=net,alias=a,ip=…
    const entry: NetworkEntry = { aliases: [], link_local_ips: [] };
    let netName = '';
    for (const field of splitCsv(value)) {
      const eq = field.indexOf('=');
      const key = eq < 0 ? 'name' : field.slice(0, eq);
      const val = eq < 0 ? field : field.slice(eq + 1);
      if (key === 'name') netName = val;
      else if (key === 'alias') entry.aliases.push(val);
      else if (key === 'ip') entry.ipv4_address = val;
      else if (key === 'ip6') entry.ipv6_address = val;
      else if (key === 'link-local-ip') entry.link_local_ips.push(val);
      else warn(ctx, `--network option "${key}" isn't converted; skipped.`);
    }
    if (netName) ctx.networks.set(netName, entry);
    return;
  }
  if (!ctx.networks.has(name)) ctx.networks.set(name, { aliases: [], link_local_ips: [] });
}

const NO_EQUIVALENT = 'has no Compose equivalent; skipped.';

const OPTIONS: Option[] = [
  { names: ['--name'], value: true, handle: (ctx, v) => (ctx.service.container_name = v) },
  { names: ['-p', '--publish'], value: true, handle: push('ports') },
  {
    names: ['-P', '--publish-all'],
    value: false,
    handle: unsupported(
      '(publish all exposed ports on random host ports) has no Compose equivalent; list them under ports instead.',
    ),
  },
  { names: ['--expose'], value: true, handle: push('expose') },
  { names: ['-v', '--volume'], value: true, handle: volumeShort },
  { names: ['--mount'], value: true, handle: mount },
  { names: ['--tmpfs'], value: true, handle: push('tmpfs') },
  { names: ['-e', '--env'], value: true, handle: push('environment') },
  { names: ['--env-file'], value: true, handle: push('env_file') },
  { names: ['-l', '--label'], value: true, handle: push('labels') },
  { names: ['--label-file'], value: true, handle: push('label_file') },
  { names: ['--annotation'], value: true, handle: mapEntry('annotations') },
  { names: ['--restart'], value: true, handle: set('restart') },
  { names: ['--network', '--net'], value: true, handle: network },
  { names: ['--network-alias', '--net-alias'], value: true, handle: (ctx, v) => ctx.pendingAliases.push(v) },
  { names: ['--ip'], value: true, handle: (ctx, v) => (ctx.pendingIp.v4 = v) },
  { names: ['--ip6'], value: true, handle: (ctx, v) => (ctx.pendingIp.v6 = v) },
  { names: ['--link-local-ip'], value: true, handle: (ctx, v) => ctx.pendingIp.linkLocal.push(v) },
  { names: ['-w', '--workdir'], value: true, handle: set('working_dir') },
  { names: ['-u', '--user'], value: true, handle: set('user') },
  { names: ['-h', '--hostname'], value: true, handle: set('hostname') },
  { names: ['--domainname'], value: true, handle: set('domainname') },
  { names: ['--mac-address'], value: true, handle: set('mac_address') },
  {
    names: ['--entrypoint'],
    value: true,
    // Docker treats the value as one executable path, never as shell words.
    handle: (ctx, v) => (ctx.service.entrypoint = v === '' ? [] : /^[^\s'"\\$`]+$/.test(v) ? v : [v]),
  },
  { names: ['-i', '--interactive'], value: false, handle: bool('stdin_open') },
  { names: ['-t', '--tty'], value: false, handle: bool('tty') },
  {
    names: ['-d', '--detach'],
    value: false,
    handle: info('Compose runs services in the background with "docker compose up -d".'),
  },
  {
    names: ['--rm'],
    value: false,
    handle: info('no Compose equivalent; "docker compose down" removes the containers.'),
  },
  { names: ['--privileged'], value: false, handle: bool('privileged') },
  { names: ['--read-only'], value: false, handle: bool('read_only') },
  { names: ['--init'], value: false, handle: bool('init') },
  { names: ['--oom-kill-disable'], value: false, handle: bool('oom_kill_disable') },
  { names: ['--cap-add'], value: true, handle: push('cap_add') },
  { names: ['--cap-drop'], value: true, handle: push('cap_drop') },
  { names: ['--device'], value: true, handle: push('devices') },
  { names: ['--device-cgroup-rule'], value: true, handle: push('device_cgroup_rules') },
  { names: ['--dns'], value: true, handle: push('dns') },
  { names: ['--dns-search'], value: true, handle: push('dns_search') },
  { names: ['--dns-option', '--dns-opt'], value: true, handle: push('dns_opt') },
  { names: ['--add-host'], value: true, handle: push('extra_hosts') },
  {
    names: ['--health-cmd'],
    value: true,
    handle: (ctx, v) => (nested(ctx, 'healthcheck').test = ['CMD-SHELL', v]),
  },
  { names: ['--health-interval'], value: true, handle: healthcheck('interval') },
  { names: ['--health-timeout'], value: true, handle: healthcheck('timeout') },
  { names: ['--health-retries'], value: true, handle: healthcheck('retries', toInt) },
  { names: ['--health-start-period'], value: true, handle: healthcheck('start_period') },
  { names: ['--health-start-interval'], value: true, handle: healthcheck('start_interval') },
  {
    names: ['--no-healthcheck'],
    value: false,
    handle: (ctx, v) => {
      if (isTrue(v)) ctx.service.healthcheck = { disable: true };
    },
  },
  { names: ['-m', '--memory'], value: true, handle: set('mem_limit') },
  { names: ['--memory-reservation'], value: true, handle: set('mem_reservation') },
  { names: ['--memory-swap'], value: true, handle: set('memswap_limit') },
  { names: ['--memory-swappiness'], value: true, handle: set('mem_swappiness', toInt) },
  { names: ['--cpus'], value: true, handle: set('cpus', toNumber) },
  { names: ['-c', '--cpu-shares'], value: true, handle: set('cpu_shares', toInt) },
  { names: ['--cpu-period'], value: true, handle: set('cpu_period', toInt) },
  { names: ['--cpu-quota'], value: true, handle: set('cpu_quota', toInt) },
  { names: ['--cpu-rt-period'], value: true, handle: set('cpu_rt_period', toInt) },
  { names: ['--cpu-rt-runtime'], value: true, handle: set('cpu_rt_runtime', toInt) },
  { names: ['--cpuset-cpus'], value: true, handle: set('cpuset') },
  { names: ['--cpu-count'], value: true, handle: set('cpu_count', toInt) },
  { names: ['--cpu-percent'], value: true, handle: set('cpu_percent', toInt) },
  { names: ['--pids-limit'], value: true, handle: set('pids_limit', toInt) },
  { names: ['--oom-score-adj'], value: true, handle: set('oom_score_adj', toInt) },
  { names: ['--ulimit'], value: true, handle: ulimit },
  { names: ['--blkio-weight'], value: true, handle: (ctx, v) => (nested(ctx, 'blkio_config').weight = toInt(v)) },
  { names: ['--blkio-weight-device'], value: true, handle: blkioDevice('weight_device', 'weight', true) },
  { names: ['--device-read-bps'], value: true, handle: blkioDevice('device_read_bps', 'rate', false) },
  { names: ['--device-write-bps'], value: true, handle: blkioDevice('device_write_bps', 'rate', false) },
  { names: ['--device-read-iops'], value: true, handle: blkioDevice('device_read_iops', 'rate', true) },
  { names: ['--device-write-iops'], value: true, handle: blkioDevice('device_write_iops', 'rate', true) },
  { names: ['--log-driver'], value: true, handle: (ctx, v) => (nested(ctx, 'logging').driver = v) },
  {
    names: ['--log-opt'],
    value: true,
    handle: (ctx, v, flag) => {
      const eq = v.indexOf('=');
      if (eq <= 0) warn(ctx, `${flag} ${v}: expected key=value; skipped.`);
      else nested(ctx, 'logging', 'options')[v.slice(0, eq)] = v.slice(eq + 1);
    },
  },
  { names: ['--platform'], value: true, handle: set('platform') },
  { names: ['--pull'], value: true, handle: set('pull_policy') },
  { names: ['--pid'], value: true, handle: set('pid') },
  { names: ['--ipc'], value: true, handle: set('ipc') },
  { names: ['--uts'], value: true, handle: set('uts') },
  { names: ['--shm-size'], value: true, handle: set('shm_size') },
  { names: ['--sysctl'], value: true, handle: mapEntry('sysctls') },
  { names: ['--storage-opt'], value: true, handle: mapEntry('storage_opt') },
  { names: ['--security-opt'], value: true, handle: push('security_opt') },
  { names: ['--stop-signal'], value: true, handle: set('stop_signal') },
  {
    names: ['--stop-timeout'],
    value: true,
    handle: (ctx, v) => (ctx.service.stop_grace_period = /^\d+$/.test(v) ? `${v}s` : v),
  },
  { names: ['--group-add'], value: true, handle: push('group_add') },
  { names: ['--gpus'], value: true, handle: gpus },
  { names: ['--runtime'], value: true, handle: set('runtime') },
  { names: ['--userns'], value: true, handle: set('userns_mode') },
  { names: ['--cgroupns'], value: true, handle: set('cgroup') },
  { names: ['--cgroup-parent'], value: true, handle: set('cgroup_parent') },
  { names: ['--isolation'], value: true, handle: set('isolation') },
  { names: ['--volume-driver'], value: true, handle: set('volume_driver') },
  { names: ['--link'], value: true, handle: (ctx, v) => ctx.links.push(v) },
  { names: ['--volumes-from'], value: true, handle: (ctx, v) => ctx.volumesFrom.push(v) },
  { names: ['-a', '--attach'], value: true, handle: unsupported(NO_EQUIVALENT) },
  { names: ['--cidfile'], value: true, handle: unsupported(NO_EQUIVALENT) },
  { names: ['--detach-keys'], value: true, handle: unsupported(NO_EQUIVALENT) },
  { names: ['--sig-proxy'], value: false, handle: unsupported(NO_EQUIVALENT) },
  { names: ['--disable-content-trust'], value: false, handle: unsupported(NO_EQUIVALENT) },
  { names: ['-q', '--quiet'], value: false, handle: unsupported(NO_EQUIVALENT) },
  { names: ['--kernel-memory'], value: true, handle: unsupported('is no longer supported by Docker; skipped.') },
  { names: ['--io-maxbandwidth', '--io-maxiops'], value: true, handle: unsupported(NO_EQUIVALENT) },
  { names: ['--use-api-socket'], value: false, handle: unsupported(NO_EQUIVALENT) },
  { names: ['--help'], value: false, handle: unsupported('is not an option for a container; skipped.') },
];

const BY_NAME = new Map<string, Option>();
for (const o of OPTIONS) for (const name of o.names) BY_NAME.set(name, o);

/** The order keys appear in within a service. */
const ORDER = [
  'image',
  'container_name',
  'hostname',
  'domainname',
  'platform',
  'pull_policy',
  'restart',
  'init',
  'privileged',
  'read_only',
  'user',
  'group_add',
  'working_dir',
  'entrypoint',
  'command',
  'stdin_open',
  'tty',
  'environment',
  'env_file',
  'labels',
  'label_file',
  'annotations',
  'ports',
  'expose',
  'volumes',
  'volumes_from',
  'tmpfs',
  'network_mode',
  'networks',
  'links',
  'external_links',
  'extra_hosts',
  'dns',
  'dns_search',
  'dns_opt',
  'mac_address',
  'cap_add',
  'cap_drop',
  'security_opt',
  'devices',
  'device_cgroup_rules',
  'sysctls',
  'ulimits',
  'mem_limit',
  'mem_reservation',
  'memswap_limit',
  'mem_swappiness',
  'cpus',
  'cpu_shares',
  'cpu_period',
  'cpu_quota',
  'cpu_rt_period',
  'cpu_rt_runtime',
  'cpuset',
  'cpu_count',
  'cpu_percent',
  'pids_limit',
  'oom_kill_disable',
  'oom_score_adj',
  'blkio_config',
  'shm_size',
  'storage_opt',
  'pid',
  'ipc',
  'uts',
  'userns_mode',
  'cgroup',
  'cgroup_parent',
  'isolation',
  'runtime',
  'volume_driver',
  'healthcheck',
  'stop_signal',
  'stop_grace_period',
  'logging',
  'deploy',
];

export function orderService(service: Obj): Obj {
  const out: Obj = {};
  for (const key of ORDER) if (key in service) out[key] = service[key];
  for (const key of Object.keys(service)) if (!(key in out)) out[key] = service[key];
  return out;
}

const DOCKER_GLOBAL_WITH_VALUE = new Set([
  '-H',
  '--host',
  '-c',
  '--context',
  '--config',
  '-l',
  '--log-level',
  '--tlscacert',
  '--tlscert',
  '--tlskey',
]);

const display = (s: string) => s.replaceAll(LITERAL_DOLLAR, '$');
const clip = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

/**
 * Finds the arguments after `docker run` (or `docker container run`, `podman
 * run`…). Returns undefined, with a reason, for other commands.
 */
export function runArguments(words: string[]): { args: string[] } | { skip: string } {
  let i = 0;
  // Prompts ("$ docker run"), sudo and leading VAR=value assignments.
  while (i < words.length) {
    const w = words[i]!;
    if (w === LITERAL_DOLLAR || w === '$' || w === '#') i++;
    else if (w === 'sudo') {
      i++;
      while (words[i]?.startsWith('-')) i++;
    } else if (/^[A-Za-z_]\w*=/.test(w)) i++;
    else break;
  }
  const program = (words[i] ?? '')
    .split('/')
    .pop()!
    .replace(/\.exe$/, '');
  if (!['docker', 'podman', 'nerdctl'].includes(program)) {
    return { skip: `Skipped "${clip(display(words.join(' ')))}": not a docker command.` };
  }
  i++;
  while (i < words.length && words[i]!.startsWith('-')) {
    const flag = words[i]!;
    i += !flag.includes('=') && DOCKER_GLOBAL_WITH_VALUE.has(flag) ? 2 : 1;
  }
  let sub = words[i];
  if (sub === 'container') sub = words[++i];
  if (sub === 'run' || sub === 'create') return { args: words.slice(i + 1) };
  return {
    skip: `Skipped "${clip(display(words.join(' ')))}": only docker run commands are converted.`,
  };
}

/** Parses the arguments of one docker run command. */
export function parseRun(args: string[]): ParsedService {
  const ctx: Ctx = {
    name: '',
    service: {},
    networks: new Map(),
    links: [],
    volumesFrom: [],
    namedVolumes: new Set(),
    notes: [],
    once: new Set(),
    pendingAliases: [],
    pendingIp: { linkLocal: [] },
  };
  let image: string | undefined;
  let i = 0;
  const unknown = (flag: string) =>
    warn(ctx, `Unknown option ${flag}; skipped. If it takes a value, write it as ${flag}=value.`);

  while (i < args.length) {
    const arg = args[i]!;
    if (arg === '--') {
      i++;
      image = args[i++];
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const flag = eq < 0 ? arg : arg.slice(0, eq);
      const option = BY_NAME.get(flag);
      i++;
      if (!option) {
        unknown(flag);
        continue;
      }
      let value: string;
      if (eq >= 0) value = arg.slice(eq + 1);
      else if (!option.value) value = 'true';
      else if (i < args.length) value = args[i++]!;
      else {
        warn(ctx, `${flag} needs a value; skipped.`);
        continue;
      }
      option.handle(ctx, value, flag);
      continue;
    }
    if (arg.startsWith('-') && arg.length > 1) {
      i++;
      // Combined short flags: -dit, -p8080:80, -e=FOO.
      for (let k = 1; k < arg.length; k++) {
        const flag = `-${arg[k]}`;
        const option = BY_NAME.get(flag);
        if (!option) {
          unknown(flag);
          continue;
        }
        if (!option.value) {
          option.handle(ctx, 'true', flag);
          continue;
        }
        let value = arg.slice(k + 1);
        if (value.startsWith('=')) value = value.slice(1);
        else if (value === '') {
          if (i >= args.length) {
            warn(ctx, `${flag} needs a value; skipped.`);
            break;
          }
          value = args[i++]!;
        }
        option.handle(ctx, value, flag);
        break;
      }
      continue;
    }
    image = arg;
    i++;
    break;
  }

  const command = args.slice(i);
  if (image === undefined) {
    warn(ctx, 'This docker run command has no image; add one after the options.');
    image = '';
  }
  ctx.service = { image, ...ctx.service };
  if (command.length > 0) ctx.service.command = command;

  // Aliases and fixed addresses belong to a network.
  if (ctx.pendingAliases.length || ctx.pendingIp.v4 || ctx.pendingIp.v6 || ctx.pendingIp.linkLocal.length) {
    let target = [...ctx.networks.values()][0];
    if (!target) {
      warn(ctx, '--network-alias and --ip only work on a user-defined network; they were added to "default".');
      target = { aliases: [], link_local_ips: [] };
      ctx.networks.set('default', target);
    }
    target.aliases.push(...ctx.pendingAliases);
    if (ctx.pendingIp.v4) target.ipv4_address = ctx.pendingIp.v4;
    if (ctx.pendingIp.v6) target.ipv6_address = ctx.pendingIp.v6;
    target.link_local_ips.push(...ctx.pendingIp.linkLocal);
  }
  if (ctx.networkMode && ctx.networks.size > 0) {
    warn(ctx, `--network ${ctx.networkMode} can't be combined with other networks; the other networks were kept.`);
    delete ctx.networkMode;
  }

  const name = typeof ctx.service.container_name === 'string' ? ctx.service.container_name : imageName(image);
  ctx.name = serviceName(name);
  const { once: _once, pendingAliases: _a, pendingIp: _p, ...parsed } = ctx;
  return parsed;
}

/** "ghcr.io/org/app:1.2@sha256:…" → "app". */
export function imageName(image: string): string {
  const noDigest = image.split('@')[0]!;
  const last = noDigest.split('/').pop() ?? '';
  return last.split(':')[0] ?? '';
}

export function serviceName(raw: string): string {
  const cleaned = display(raw)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+$/, '');
  return cleaned || 'app';
}

export interface RunToComposeResult {
  compose: Obj;
  notes: Note[];
}

/** Converts docker run commands into a Compose document (as a plain object). */
export function runToCompose(input: string): RunToComposeResult {
  const commands: ShellCommand[] = splitCommands(input);
  const notes: Note[] = [];
  const parsed: ParsedService[] = [];
  for (const command of commands) {
    const found = runArguments(command.words);
    if ('skip' in found) {
      notes.push({ level: 'info', message: `Line ${command.line}: ${found.skip}` });
      continue;
    }
    if (command.end === '|') {
      notes.push({
        level: 'warning',
        message: `Line ${command.line}: the output of docker run is piped; the pipe was ignored.`,
      });
    }
    parsed.push(parseRun(found.args));
  }
  if (parsed.length === 0) {
    throw new ToolInputError('No docker run command found. Paste one or more commands that start with "docker run".');
  }

  // Unique service names, and a lookup from container name to service name.
  const used = new Map<string, number>();
  const byContainer = new Map<string, string>();
  for (const p of parsed) {
    const count = (used.get(p.name) ?? 0) + 1;
    used.set(p.name, count);
    if (count > 1) p.name = `${p.name}-${count}`;
    const container = p.service.container_name;
    if (typeof container === 'string') byContainer.set(container, p.name);
  }

  const services: Obj = {};
  const topNetworks = new Set<string>();
  const topVolumes = new Set<string>();
  const multiple = parsed.length > 1;
  for (const p of parsed) {
    const svc = p.service;
    if (p.networkMode) {
      const m = /^container:(.+)$/.exec(p.networkMode);
      const target = m ? byContainer.get(m[1]!) : undefined;
      svc.network_mode = target ? `service:${target}` : p.networkMode;
    }
    if (p.networks.size > 0) {
      const detailed = [...p.networks.values()].some(
        (n) => n.aliases.length || n.ipv4_address || n.ipv6_address || n.link_local_ips.length,
      );
      if (detailed) {
        const map: Obj = {};
        for (const [name, n] of p.networks) {
          const entry: Obj = {};
          if (n.aliases.length) entry.aliases = n.aliases;
          if (n.ipv4_address) entry.ipv4_address = n.ipv4_address;
          if (n.ipv6_address) entry.ipv6_address = n.ipv6_address;
          if (n.link_local_ips.length) entry.link_local_ips = n.link_local_ips;
          map[name] = Object.keys(entry).length ? entry : null;
        }
        svc.networks = map;
      } else svc.networks = [...p.networks.keys()];
      for (const name of p.networks.keys()) if (name !== 'default') topNetworks.add(name);
    }
    for (const link of p.links) {
      const [container = '', alias] = link.split(':');
      const target = byContainer.get(container);
      if (target) ((svc.links ??= []) as string[]).push(alias && alias !== target ? `${target}:${alias}` : target);
      else ((svc.external_links ??= []) as string[]).push(link);
    }
    if (p.links.length) {
      p.notes.push({
        level: 'warning',
        message: '--link is deprecated: containers on the same network already reach each other by service name.',
      });
    }
    for (const from of p.volumesFrom) {
      const [container = '', mode] = from.split(':');
      const target = byContainer.get(container);
      const ref = target ?? `container:${container}`;
      ((svc.volumes_from ??= []) as string[]).push(mode ? `${ref}:${mode}` : ref);
    }
    for (const v of p.namedVolumes) topVolumes.add(v);
    services[p.name] = orderService(svc);
    const prefix = multiple ? `${p.name}: ` : '';
    for (const note of p.notes) notes.push({ level: note.level, message: prefix + note.message });
  }

  const compose: Obj = { services };
  if (topNetworks.size > 0) {
    compose.networks = Object.fromEntries([...topNetworks].map((n) => [n, { external: true }]));
    notes.push({
      level: 'info',
      message:
        'Networks used by docker run must already exist, so they are declared external. Remove "external: true" to let Compose create them.',
    });
  }
  if (topVolumes.size > 0) {
    compose.volumes = Object.fromEntries([...topVolumes].map((v) => [v, {}]));
    notes.push({
      level: 'info',
      message:
        'Compose prefixes named volumes with the project name. To keep using an existing volume, add "external: true" to it.',
    });
  }
  return { compose, notes };
}
