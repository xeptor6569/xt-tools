// Compose services → docker run commands.
import { parseDocument } from 'yaml';
import { ToolInputError } from '../types.ts';
import type { Note } from './run-to-compose.ts';
import { LITERAL_DOLLAR, quoteComposeValue, splitCommands } from './shell.ts';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A word built from pieces: plain strings are quoted, `{ raw }` pieces are inserted as is. */
type Piece = string | { raw: string };

function word(...pieces: Piece[]): string {
  let out = '';
  let text = '';
  for (const p of pieces) {
    if (typeof p === 'string') text += p;
    else {
      if (text) out += quoteComposeValue(text);
      text = '';
      out += p.raw;
    }
  }
  if (text || !out) out += quoteComposeValue(text);
  return out;
}

const PWD = { raw: '"$(pwd)"' };

interface Top {
  networks: Obj;
  volumes: Obj;
  secrets: Obj;
  configs: Obj;
  /** Service name → the container name used for its docker run command. */
  containers: Map<string, string>;
}

class ServiceBuilder {
  readonly lines: string[] = [];
  readonly notes: Note[] = [];
  readonly networksUsed: string[] = [];

  readonly name: string;
  readonly top: Top;

  constructor(name: string, top: Top) {
    this.name = name;
    this.top = top;
  }

  warn(message: string) {
    this.notes.push({ level: 'warning', message: `${this.name}: ${message}` });
  }
  info(message: string) {
    this.notes.push({ level: 'info', message: `${this.name}: ${message}` });
  }
  add(flag: string, ...pieces: Piece[]) {
    this.lines.push(pieces.length ? `${flag} ${word(...pieces)}` : flag);
  }

  scalar(key: string, v: unknown): string | undefined {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
    if (v !== null && v !== undefined) this.warn(`"${key}" should be a single value; skipped.`);
    return undefined;
  }
  list(key: string, v: unknown): string[] {
    if (v === null || v === undefined) return [];
    if (!Array.isArray(v)) {
      const s = this.scalar(key, v);
      return s === undefined ? [] : [s];
    }
    return v.flatMap((item) => {
      const s = this.scalar(key, item);
      return s === undefined ? [] : [s];
    });
  }
  /** A map ({ K: v }) or a list (["K=v"]) as "K=v" strings; null values give just "K". */
  pairs(key: string, v: unknown, sep = '='): string[] {
    if (isObj(v)) {
      return Object.entries(v).flatMap(([k, val]) => {
        if (val === null || val === undefined) return [k];
        if (Array.isArray(val)) return val.map((x) => `${k}${sep}${String(x)}`);
        const s = this.scalar(`${key}.${k}`, val);
        return s === undefined ? [] : [`${k}${sep}${s}`];
      });
    }
    return this.list(key, v);
  }
}

/** Go-style durations ("1m30s") → whole seconds. */
export function durationSeconds(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value);
  const units: Record<string, number> = { h: 3600, m: 60, s: 1, ms: 1e-3, us: 1e-6, µs: 1e-6, ns: 1e-9 };
  let total = 0;
  let rest = value;
  const re = /^(\d+(?:\.\d+)?)(h|ms|m|s|us|µs|ns)/;
  if (!rest) return undefined;
  while (rest) {
    const m = re.exec(rest);
    if (!m) return undefined;
    total += Number(m[1]) * units[m[2]!]!;
    rest = rest.slice(m[0].length);
  }
  return Math.ceil(total);
}

/** Splits a Compose command string into words, as Compose does. */
function shellWords(value: string): string[] {
  const out: string[] = [];
  for (const c of splitCommands(value)) {
    out.push(...c.words.map((w) => w.replaceAll(LITERAL_DOLLAR, '$')));
    if (c.end !== 'eol' && c.end !== 'eof') out.push(c.end);
  }
  return out;
}

function hostPath(b: ServiceBuilder, source: string): Piece[] {
  if (source === '.' || source === '..' || source.startsWith('./') || source.startsWith('../')) {
    return source === '.' ? [PWD] : [PWD, source.startsWith('./') ? source.slice(1) : `/${source}`];
  }
  if (source === '~' || source.startsWith('~/')) return [{ raw: '~' }, source.slice(1)];
  if (/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(source)) return [volumeName(b, source)];
  return [source];
}

function volumeName(b: ServiceBuilder, name: string): string {
  const def = b.top.volumes[name];
  if (isObj(def) && typeof def.name === 'string') return def.name;
  return name;
}

function shortVolume(b: ServiceBuilder, value: string) {
  const drive = /^[A-Za-z]:[\\/]/.test(value) ? 2 : 0;
  const colon = value.indexOf(':', drive);
  if (colon < 0) {
    b.add('-v', value);
    return;
  }
  b.add('-v', ...hostPath(b, value.slice(0, colon)), value.slice(colon));
}

function longVolume(b: ServiceBuilder, v: Obj) {
  const type = typeof v.type === 'string' ? v.type : 'volume';
  const pieces: Piece[] = [`type=${type}`];
  if (v.source !== undefined && v.source !== null) {
    const source = String(v.source);
    pieces.push(
      ',source=',
      ...(type === 'bind' ? hostPath(b, source) : type === 'volume' ? [volumeName(b, source)] : [source]),
    );
  }
  if (v.target !== undefined) pieces.push(`,target=${String(v.target)}`);
  if (v.read_only === true) pieces.push(',readonly');
  if (typeof v.consistency === 'string') pieces.push(`,consistency=${v.consistency}`);
  const sub = (group: string, key: string, flag: string) => {
    const g = v[group];
    if (isObj(g) && g[key] !== undefined && g[key] !== null) pieces.push(`,${flag}=${String(g[key])}`);
  };
  sub('bind', 'propagation', 'bind-propagation');
  sub('bind', 'recursive', 'bind-recursive');
  sub('volume', 'nocopy', 'volume-nocopy');
  sub('volume', 'subpath', 'volume-subpath');
  sub('tmpfs', 'size', 'tmpfs-size');
  sub('tmpfs', 'mode', 'tmpfs-mode');
  sub('image', 'subpath', 'image-subpath');
  if (isObj(v.bind) && v.bind.selinux)
    b.warn('bind.selinux has no --mount equivalent; use the short "-v src:dst:z" syntax.');
  if (type === 'bind' && !(isObj(v.bind) && v.bind.create_host_path === false)) {
    b.info('--mount type=bind needs the host path to exist (Compose would create it).');
  }
  b.add('--mount', ...pieces);
}

function port(b: ServiceBuilder, v: unknown) {
  if (!isObj(v)) {
    const s = b.scalar('ports', v);
    if (s !== undefined) b.add('-p', s);
    return;
  }
  if (v.target === undefined) {
    b.warn('a long-syntax port has no target; skipped.');
    return;
  }
  let spec = String(v.target);
  const published = v.published === undefined || v.published === null ? undefined : String(v.published);
  if (published !== undefined) spec = `${published}:${spec}`;
  if (typeof v.host_ip === 'string') {
    const ip = v.host_ip.includes(':') ? `[${v.host_ip}]` : v.host_ip;
    spec = `${ip}:${published === undefined ? ':' : ''}${spec}`;
  }
  if (typeof v.protocol === 'string' && v.protocol !== 'tcp') spec += `/${v.protocol}`;
  b.add('-p', spec);
}

function healthcheck(b: ServiceBuilder, h: unknown) {
  if (!isObj(h)) return;
  if (h.disable === true) {
    b.add('--no-healthcheck');
    return;
  }
  const test = h.test;
  let cmd: string | undefined;
  if (typeof test === 'string') cmd = test;
  else if (Array.isArray(test)) {
    const [kind, ...args] = test.map(String);
    if (kind === 'NONE') {
      b.add('--no-healthcheck');
      return;
    }
    if (kind === 'CMD-SHELL') cmd = args.join(' ');
    else if (kind === 'CMD') {
      cmd = args.map((a) => (/^[^\s'"\\`;&|<>()*?#~]+$/.test(a) ? a : `'${a.replaceAll("'", `'\\''`)}'`)).join(' ');
    } else b.warn('healthcheck.test must start with CMD, CMD-SHELL or NONE; skipped.');
  }
  if (cmd !== undefined) b.add('--health-cmd', cmd);
  for (const [key, flag] of [
    ['interval', '--health-interval'],
    ['timeout', '--health-timeout'],
    ['retries', '--health-retries'],
    ['start_period', '--health-start-period'],
    ['start_interval', '--health-start-interval'],
  ] as const) {
    const s = b.scalar(`healthcheck.${key}`, h[key]);
    if (s !== undefined) b.add(flag, s);
  }
}

function gpuFlag(b: ServiceBuilder, devices: unknown): boolean {
  if (!Array.isArray(devices)) return false;
  let found = false;
  for (const d of devices) {
    if (!isObj(d)) continue;
    const caps = Array.isArray(d.capabilities) ? d.capabilities.map(String) : [];
    if (!caps.includes('gpu')) {
      b.warn('deploy device reservations without the "gpu" capability have no docker run equivalent; skipped.');
      continue;
    }
    found = true;
    const extra = caps.filter((c) => c !== 'gpu');
    const parts: string[] = [];
    if (Array.isArray(d.device_ids)) parts.push(`device=${d.device_ids.map(String).join(',')}`);
    else if (d.count !== undefined)
      parts.push(d.count === 'all' || d.count === -1 ? 'all' : `count=${String(d.count)}`);
    else parts.push('all');
    if (typeof d.driver === 'string' && d.driver !== 'nvidia') parts.push(`driver=${d.driver}`);
    if (extra.length) parts.push(`capabilities=${extra.join(',')}`);
    const value = parts.length === 1 && parts[0] === 'all' ? 'all' : parts.join(',');
    // Docker reads the value as CSV, so a list of device ids needs inner quotes.
    b.add('--gpus', value.includes(',') ? `"${value}"` : value);
  }
  return found;
}

function deploy(b: ServiceBuilder, d: unknown, has: (flag: string) => boolean) {
  if (!isObj(d)) return;
  for (const key of Object.keys(d)) {
    if (key === 'resources' || key === 'restart_policy') continue;
    if (key === 'replicas') b.warn('deploy.replicas: run the command once per replica, each with its own --name.');
    else b.warn(`deploy.${key} has no docker run equivalent; skipped.`);
  }
  const r = d.resources;
  if (isObj(r)) {
    const limits = isObj(r.limits) ? r.limits : {};
    const reservations = isObj(r.reservations) ? r.reservations : {};
    const pairs: Array<[unknown, string]> = [
      [limits.cpus, '--cpus'],
      [limits.memory, '--memory'],
      [limits.pids, '--pids-limit'],
      [reservations.memory, '--memory-reservation'],
    ];
    for (const [value, flag] of pairs) {
      const s = b.scalar(flag, value);
      if (s !== undefined && !has(flag)) b.add(flag, s);
    }
    if (reservations.cpus !== undefined)
      b.warn('deploy.resources.reservations.cpus has no docker run equivalent; skipped.');
    gpuFlag(b, reservations.devices);
  }
  const p = d.restart_policy;
  if (isObj(p) && !has('--restart')) {
    const condition = typeof p.condition === 'string' ? p.condition : 'any';
    if (condition === 'none') b.add('--restart', 'no');
    else if (condition === 'on-failure') {
      b.add('--restart', p.max_attempts !== undefined ? `on-failure:${String(p.max_attempts)}` : 'on-failure');
    } else b.add('--restart', 'always');
    if (p.delay !== undefined || p.window !== undefined)
      b.warn('restart_policy delay and window have no docker run equivalent.');
  }
}

/** Keys handled by simple one-flag mappings. */
const SCALARS: Record<string, string> = {
  hostname: '--hostname',
  domainname: '--domainname',
  platform: '--platform',
  restart: '--restart',
  user: '--user',
  working_dir: '--workdir',
  mac_address: '--mac-address',
  mem_limit: '--memory',
  mem_reservation: '--memory-reservation',
  memswap_limit: '--memory-swap',
  mem_swappiness: '--memory-swappiness',
  cpus: '--cpus',
  cpu_shares: '--cpu-shares',
  cpu_period: '--cpu-period',
  cpu_quota: '--cpu-quota',
  cpu_rt_period: '--cpu-rt-period',
  cpu_rt_runtime: '--cpu-rt-runtime',
  cpuset: '--cpuset-cpus',
  cpu_count: '--cpu-count',
  cpu_percent: '--cpu-percent',
  pids_limit: '--pids-limit',
  oom_score_adj: '--oom-score-adj',
  shm_size: '--shm-size',
  pid: '--pid',
  uts: '--uts',
  userns_mode: '--userns',
  cgroup: '--cgroupns',
  cgroup_parent: '--cgroup-parent',
  isolation: '--isolation',
  runtime: '--runtime',
  stop_signal: '--stop-signal',
  volume_driver: '--volume-driver',
};

const BOOLEANS: Record<string, string> = {
  init: '--init',
  privileged: '--privileged',
  read_only: '--read-only',
  oom_kill_disable: '--oom-kill-disable',
};

const LISTS: Record<string, string> = {
  cap_add: '--cap-add',
  cap_drop: '--cap-drop',
  dns: '--dns',
  dns_search: '--dns-search',
  dns_opt: '--dns-option',
  security_opt: '--security-opt',
  group_add: '--group-add',
  device_cgroup_rules: '--device-cgroup-rule',
  expose: '--expose',
  label_file: '--label-file',
  tmpfs: '--tmpfs',
};

const MAPS: Record<string, string> = {
  environment: '-e',
  labels: '-l',
  sysctls: '--sysctl',
  annotations: '--annotation',
  storage_opt: '--storage-opt',
};

const NO_EQUIVALENT: Record<string, string> = {
  build: 'is handled by the docker build command above.',
  depends_on: 'has no docker run equivalent; the commands are listed in dependency order instead.',
  profiles: 'has no docker run equivalent; skipped.',
  scale: 'has no docker run equivalent: run the command once per copy, each with its own --name.',
  develop: '(watch mode) has no docker run equivalent; skipped.',
  extends: 'is not resolved by this tool; merge the base service by hand.',
  post_start: 'hooks have no docker run equivalent; use docker exec after starting.',
  pre_stop: 'hooks have no docker run equivalent; use docker exec before stopping.',
  attach: 'has no docker run equivalent; skipped.',
  credential_spec: 'has no docker run equivalent; skipped.',
  use_api_socket: 'has no docker run equivalent; skipped.',
  models: 'has no docker run equivalent; skipped.',
  provider: 'has no docker run equivalent; skipped.',
};

function mountFile(b: ServiceBuilder, kind: 'secrets' | 'configs', ref: unknown) {
  const source = isObj(ref) ? String(ref.source ?? '') : String(ref);
  const def = (kind === 'secrets' ? b.top.secrets : b.top.configs)[source];
  let target = isObj(ref) && typeof ref.target === 'string' ? ref.target : source;
  if (kind === 'secrets' && !target.startsWith('/')) target = `/run/secrets/${target}`;
  if (kind === 'configs' && !target.startsWith('/')) target = `/${target}`;
  if (isObj(def) && typeof def.file === 'string') {
    b.add('-v', ...hostPath(b, def.file), `:${target}:ro`);
  } else if (isObj(def) && typeof def.environment === 'string') {
    b.warn(
      `${kind.slice(0, -1)} "${source}" comes from an environment variable; mount it as a file or pass it with -e.`,
    );
  } else {
    b.warn(`${kind.slice(0, -1)} "${source}" isn't defined as a file at the top level; skipped.`);
  }
}

function convertService(name: string, svc: Obj, top: Top): { builder: ServiceBuilder; build?: string } {
  const b = new ServiceBuilder(name, top);
  const handled = new Set(['image', 'container_name', 'command', 'entrypoint', 'stdin_open', 'tty']);
  const has = (flag: string) => b.lines.some((l) => l === flag || l.startsWith(`${flag} `));

  let image = typeof svc.image === 'string' ? svc.image : '';
  let build: string | undefined;
  if (svc.build !== undefined) {
    if (!image) image = name.toLowerCase();
    build = buildCommand(b, svc.build, image);
    b.info('the image is built first with docker build.');
  } else if (!image) {
    b.warn('has no image; set "image:" so docker run knows what to start.');
    image = name.toLowerCase();
  }

  b.add('--name', top.containers.get(name) ?? name);
  const interactive = [svc.stdin_open === true ? 'i' : '', svc.tty === true ? 't' : ''].join('');
  if (interactive) b.lines.push(`-${interactive}`);

  for (const [key, value] of Object.entries(svc)) {
    if (handled.has(key) || key.startsWith('x-')) continue;
    if (key in SCALARS) {
      const s = b.scalar(key, value);
      if (s !== undefined) b.add(SCALARS[key]!, s);
    } else if (key in BOOLEANS) {
      if (value === true) b.add(BOOLEANS[key]!);
    } else if (key in LISTS) {
      for (const item of b.list(key, value)) b.add(LISTS[key]!, item);
    } else if (key in MAPS) {
      for (const item of b.pairs(key, value)) b.add(MAPS[key]!, item);
    } else {
      switch (key) {
        case 'ports':
          for (const p of Array.isArray(value) ? value : [value]) port(b, p);
          break;
        case 'volumes':
          for (const v of Array.isArray(value) ? value : [value]) {
            if (isObj(v)) longVolume(b, v);
            else if (typeof v === 'string') shortVolume(b, v);
          }
          break;
        case 'env_file':
          for (const f of Array.isArray(value) ? value : [value]) {
            const path = isObj(f) ? f.path : f;
            if (typeof path === 'string') b.add('--env-file', path);
            if (isObj(f) && f.required === false)
              b.warn(`env_file ${String(path)} is optional in Compose, but docker run requires it to exist.`);
          }
          break;
        case 'extra_hosts':
          for (const h of b.pairs(key, value, ':')) b.add('--add-host', h.replace('=', ':'));
          break;
        case 'devices':
          for (const d of Array.isArray(value) ? value : [value]) {
            if (isObj(d))
              b.add(
                '--device',
                [d.source, d.target, d.permissions]
                  .filter((x) => x !== undefined)
                  .map(String)
                  .join(':'),
              );
            else if (typeof d === 'string') b.add('--device', d);
          }
          break;
        case 'networks':
        case 'network_mode':
          break;
        case 'ipc': {
          const s = b.scalar(key, value);
          if (s !== undefined)
            b.add(
              '--ipc',
              s.replace(/^service:(.+)$/, (_m, x: string) => `container:${top.containers.get(x) ?? x}`),
            );
          break;
        }
        case 'links':
        case 'external_links':
          for (const l of b.list(key, value)) {
            const [target = '', alias] = l.split(':');
            const container = key === 'links' ? (top.containers.get(target) ?? target) : target;
            const as = alias ?? (key === 'links' ? target : undefined);
            b.add('--link', as && as !== container ? `${container}:${as}` : container);
          }
          b.warn('--link is deprecated; put the containers on a shared network instead.');
          break;
        case 'volumes_from':
          for (const v of b.list(key, value)) {
            const m = /^(container:)?([^:]+)(?::(ro|rw))?$/.exec(v);
            if (!m) continue;
            const container = m[1] ? m[2]! : (top.containers.get(m[2]!) ?? m[2]!);
            b.add('--volumes-from', m[3] ? `${container}:${m[3]}` : container);
          }
          break;
        case 'ulimits':
          if (isObj(value)) {
            for (const [k, l] of Object.entries(value)) {
              if (isObj(l)) b.add('--ulimit', `${k}=${String(l.soft)}:${String(l.hard)}`);
              else b.add('--ulimit', `${k}=${String(l)}`);
            }
          }
          break;
        case 'logging':
          if (isObj(value)) {
            if (typeof value.driver === 'string') b.add('--log-driver', value.driver);
            for (const o of b.pairs('logging.options', value.options)) b.add('--log-opt', o);
          }
          break;
        case 'healthcheck':
          healthcheck(b, value);
          break;
        case 'stop_grace_period': {
          const s = b.scalar(key, value);
          const seconds = s === undefined ? undefined : durationSeconds(s);
          if (seconds !== undefined) b.add('--stop-timeout', String(seconds));
          else if (s !== undefined)
            b.warn(`stop_grace_period "${s}" isn't a duration docker run understands; skipped.`);
          break;
        }
        case 'pull_policy': {
          const s = b.scalar(key, value);
          if (s === 'always' || s === 'never' || s === 'missing') b.add('--pull', s);
          else if (s === 'if_not_present') b.add('--pull', 'missing');
          else if (s !== undefined && s !== 'build')
            b.warn(`pull_policy "${s}" has no docker run equivalent; skipped.`);
          break;
        }
        case 'gpus':
          if (value === 'all') b.add('--gpus', 'all');
          else
            gpuFlag(b, Array.isArray(value) ? value.map((d) => (isObj(d) ? { capabilities: ['gpu'], ...d } : d)) : []);
          break;
        case 'blkio_config':
          if (isObj(value)) {
            const w = b.scalar('blkio_config.weight', value.weight);
            if (w !== undefined) b.add('--blkio-weight', w);
            for (const [k, flag, field] of [
              ['weight_device', '--blkio-weight-device', 'weight'],
              ['device_read_bps', '--device-read-bps', 'rate'],
              ['device_write_bps', '--device-write-bps', 'rate'],
              ['device_read_iops', '--device-read-iops', 'rate'],
              ['device_write_iops', '--device-write-iops', 'rate'],
            ] as const) {
              const list = value[k];
              if (Array.isArray(list))
                for (const e of list) if (isObj(e)) b.add(flag, `${String(e.path)}:${String(e[field])}`);
            }
          }
          break;
        case 'deploy':
          deploy(b, value, has);
          break;
        case 'secrets':
        case 'configs':
          for (const ref of Array.isArray(value) ? value : []) mountFile(b, key, ref);
          break;
        default:
          if (key in NO_EQUIVALENT) {
            if (key === 'depends_on') b.info(`"depends_on" ${NO_EQUIVALENT[key]}`);
            else if (key !== 'build') b.warn(`"${key}" ${NO_EQUIVALENT[key]}`);
          } else b.warn(`"${key}" is not a known service key or has no docker run equivalent; skipped.`);
      }
    }
  }

  // Networking.
  const mode = typeof svc.network_mode === 'string' ? svc.network_mode : undefined;
  if (mode) {
    const m = /^service:(.+)$/.exec(mode);
    b.add('--network', m ? `container:${top.containers.get(m[1]!) ?? m[1]!}` : mode);
  } else if (svc.networks !== undefined) {
    const entries: Array<[string, unknown]> = Array.isArray(svc.networks)
      ? svc.networks.map((n) => [String(n), null])
      : isObj(svc.networks)
        ? Object.entries(svc.networks)
        : [];
    const named = entries.filter(([n]) => n !== 'default');
    if (named.length < entries.length && named.length > 0) b.info('the Compose "default" network was left out.');
    named.forEach(([net, opts], index) => {
      const def = top.networks[net];
      const real = isObj(def) && typeof def.name === 'string' ? def.name : net;
      b.networksUsed.push(net);
      b.add('--network', real);
      if (!isObj(opts)) return;
      const first = index === 0;
      if (!first && (opts.aliases || opts.ipv4_address || opts.ipv6_address)) {
        b.warn(`aliases and addresses on "${net}" only apply to the first network; use docker network connect for it.`);
        return;
      }
      for (const a of b.list('aliases', opts.aliases)) b.add('--network-alias', a);
      if (typeof opts.ipv4_address === 'string') b.add('--ip', opts.ipv4_address);
      if (typeof opts.ipv6_address === 'string') b.add('--ip6', opts.ipv6_address);
      for (const ip of b.list('link_local_ips', opts.link_local_ips)) b.add('--link-local-ip', ip);
    });
    if (named.length > 1)
      b.info('several --network flags need Docker 25 or later; otherwise use docker network connect.');
  }

  // Entrypoint, image and command go last.
  let args: string[] = [];
  if (svc.entrypoint !== undefined && svc.entrypoint !== null) {
    const ep = Array.isArray(svc.entrypoint) ? svc.entrypoint.map(String) : shellWords(String(svc.entrypoint));
    if (ep.length === 0) b.add('--entrypoint', '');
    else {
      b.add('--entrypoint', ep[0]!);
      args = ep.slice(1);
    }
  }
  if (svc.command !== undefined && svc.command !== null) {
    args = [...args, ...(Array.isArray(svc.command) ? svc.command.map(String) : shellWords(String(svc.command)))];
  }
  b.lines.push([word(image), ...args.map((a) => word(a))].join(' '));
  return { builder: b, build };
}

function buildCommand(b: ServiceBuilder, build: unknown, image: string): string {
  const parts = ['docker build', `-t ${word(image)}`];
  let context = '.';
  if (typeof build === 'string') context = build;
  else if (isObj(build)) {
    if (typeof build.context === 'string') context = build.context;
    if (typeof build.dockerfile === 'string') parts.push(`-f ${word(build.dockerfile)}`);
    if (typeof build.target === 'string') parts.push(`--target ${word(build.target)}`);
    for (const a of b.pairs('build.args', build.args)) parts.push(`--build-arg ${word(a)}`);
    for (const key of Object.keys(build)) {
      if (!['context', 'dockerfile', 'target', 'args'].includes(key)) {
        b.warn(`build.${key} isn't converted; add it to docker build by hand.`);
      }
    }
  }
  parts.push(word(context));
  return parts.join(' ');
}

function networkCreate(name: string, def: unknown): string {
  const parts = ['docker network create'];
  if (isObj(def)) {
    if (typeof def.driver === 'string') parts.push(`--driver ${word(def.driver)}`);
    if (def.internal === true) parts.push('--internal');
    if (def.attachable === true) parts.push('--attachable');
    if (def.enable_ipv6 === true) parts.push('--ipv6');
    if (isObj(def.driver_opts))
      for (const [k, v] of Object.entries(def.driver_opts)) parts.push(`--opt ${word(`${k}=${String(v)}`)}`);
    if (isObj(def.ipam) && Array.isArray(def.ipam.config)) {
      for (const c of def.ipam.config) {
        if (!isObj(c)) continue;
        if (typeof c.subnet === 'string') parts.push(`--subnet ${word(c.subnet)}`);
        if (typeof c.gateway === 'string') parts.push(`--gateway ${word(c.gateway)}`);
        if (typeof c.ip_range === 'string') parts.push(`--ip-range ${word(c.ip_range)}`);
      }
    }
    if (isObj(def.labels) || Array.isArray(def.labels)) {
      const labels = isObj(def.labels)
        ? Object.entries(def.labels).map(([k, v]) => `${k}=${String(v)}`)
        : def.labels.map(String);
      for (const l of labels) parts.push(`--label ${word(l)}`);
    }
  }
  parts.push(word(name));
  return parts.join(' ');
}

function volumeCreate(name: string, def: Obj): string | undefined {
  if (def.driver === undefined && def.driver_opts === undefined && def.labels === undefined) return undefined;
  const parts = ['docker volume create'];
  if (typeof def.driver === 'string') parts.push(`--driver ${word(def.driver)}`);
  if (isObj(def.driver_opts))
    for (const [k, v] of Object.entries(def.driver_opts)) parts.push(`--opt ${word(`${k}=${String(v)}`)}`);
  if (isObj(def.labels))
    for (const [k, v] of Object.entries(def.labels)) parts.push(`--label ${word(`${k}=${String(v)}`)}`);
  parts.push(word(name));
  return parts.join(' ');
}

/** Orders services so that each one comes after the services it depends on. */
function dependencyOrder(services: Obj): string[] {
  const names = Object.keys(services);
  const deps = (n: string): string[] => {
    const svc = services[n];
    if (!isObj(svc)) return [];
    const d = svc.depends_on;
    const list = Array.isArray(d) ? d.map(String) : isObj(d) ? Object.keys(d) : [];
    return list.filter((x) => x in services);
  };
  const out: string[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (n: string) => {
    if (state.get(n)) return;
    state.set(n, 'visiting');
    for (const d of deps(n)) if (!state.get(d)) visit(d);
    state.set(n, 'done');
    out.push(n);
  };
  for (const n of names) visit(n);
  return out;
}

export interface ComposeToRunResult {
  script: string;
  notes: Note[];
}

export function composeToRun(input: string): ComposeToRunResult {
  const doc = parseDocument(input, { merge: true, prettyErrors: true });
  const error = doc.errors[0];
  if (error) throw new ToolInputError(`Invalid YAML: ${error.message.split('\n')[0]}`);
  let root: unknown;
  try {
    root = doc.toJS({ maxAliasCount: 100 });
  } catch (e) {
    throw new ToolInputError(`Invalid YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (root === null || root === undefined) return { script: '', notes: [] };
  if (!isObj(root)) throw new ToolInputError('A Compose file must be a mapping with a "services:" key.');

  const notes: Note[] = [];
  let services: Obj;
  if (isObj(root.services)) services = root.services;
  else if (root.services !== undefined)
    throw new ToolInputError('"services" must be a mapping of service names to definitions.');
  else if (Object.values(root).some((v) => isObj(v) && ('image' in v || 'build' in v))) {
    services = Object.fromEntries(Object.entries(root).filter(([, v]) => isObj(v)));
    notes.push({ level: 'info', message: 'Read as a version 1 Compose file (services at the top level).' });
  } else
    throw new ToolInputError(
      'No "services:" found. Paste a Compose file such as "services:\\n  web:\\n    image: nginx".',
    );

  if (root.version !== undefined)
    notes.push({ level: 'info', message: 'The top-level "version" key is obsolete and was ignored.' });
  const top: Top = {
    networks: isObj(root.networks) ? root.networks : {},
    volumes: isObj(root.volumes) ? root.volumes : {},
    secrets: isObj(root.secrets) ? root.secrets : {},
    configs: isObj(root.configs) ? root.configs : {},
    containers: new Map(),
  };
  for (const [name, svc] of Object.entries(services)) {
    top.containers.set(name, isObj(svc) && typeof svc.container_name === 'string' ? svc.container_name : name);
  }

  const order = dependencyOrder(services);
  const prelude: string[] = [];
  const blocks: string[] = [];
  const networks = new Set<string>();
  let withoutNetwork = 0;
  for (const name of order) {
    const svc = services[name];
    if (!isObj(svc)) {
      notes.push({ level: 'warning', message: `${name}: a service must be a mapping; skipped.` });
      continue;
    }
    const { builder, build } = convertService(name, svc, top);
    if (build) prelude.push(build);
    for (const n of builder.networksUsed) networks.add(n);
    if (!builder.networksUsed.length && svc.network_mode === undefined) withoutNetwork++;
    notes.push(...builder.notes);
    const [first, ...rest] = builder.lines;
    const lines = [`docker run -d ${first ?? ''}`.trimEnd(), ...rest.map((l) => `  ${l}`)];
    blocks.push((order.length > 1 ? `# ${name}\n` : '') + lines.join(' \\\n'));
  }

  for (const net of networks) {
    const def = top.networks[net];
    if (isObj(def) && def.external) continue;
    const real = isObj(def) && typeof def.name === 'string' ? def.name : net;
    prelude.unshift(networkCreate(real, def));
  }
  for (const [name, def] of Object.entries(top.volumes)) {
    if (!isObj(def) || def.external) continue;
    const cmd = volumeCreate(typeof def.name === 'string' ? def.name : name, def);
    if (cmd) prelude.push(cmd);
  }
  if (withoutNetwork > 1) {
    notes.push({
      level: 'info',
      message:
        'Compose puts services on a shared network so they reach each other by name. To do the same, create one with "docker network create app" and add "--network app" to each command.',
    });
  }
  if (Object.keys(top.volumes).length > 0) {
    notes.push({
      level: 'info',
      message: 'Compose prefixes volume names with the project name; these commands use the names as written.',
    });
  }
  const script = [...(prelude.length ? [prelude.join('\n')] : []), ...blocks].join('\n\n');
  return { script, notes };
}
