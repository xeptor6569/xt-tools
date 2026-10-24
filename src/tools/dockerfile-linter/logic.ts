import { ToolInputError } from '../types.ts';
import { parseDockerfile, splitArgs, type Instruction } from './parser.ts';
import { RULES, type RuleId, type Severity } from './rules.ts';
import { invocation, simpleCommands, type Invocation } from './shell.ts';

export { RULES, type RuleId, type Severity } from './rules.ts';

export interface Finding {
  line: number;
  severity: Severity;
  rule: RuleId;
  message: string;
  why: string;
}

export interface LintResult {
  findings: Finding[];
  counts: Record<Severity, number>;
  /** Number of instructions found. */
  instructions: number;
  /** True when the list was cut at MAX_FINDINGS. */
  truncated: boolean;
}

const MAX_INPUT = 1_000_000;
export const MAX_FINDINGS = 1000;

const INSTRUCTIONS = [
  'FROM',
  'RUN',
  'CMD',
  'LABEL',
  'MAINTAINER',
  'EXPOSE',
  'ENV',
  'ADD',
  'COPY',
  'ENTRYPOINT',
  'VOLUME',
  'USER',
  'WORKDIR',
  'ARG',
  'ONBUILD',
  'STOPSIGNAL',
  'HEALTHCHECK',
  'SHELL',
];
const KNOWN = new Set(INSTRUCTIONS);
const JSON_CAPABLE = new Set(['RUN', 'CMD', 'ENTRYPOINT', 'SHELL', 'VOLUME', 'COPY', 'ADD']);
const BUILTIN_ARGS = new Set([
  'BUILDPLATFORM',
  'BUILDOS',
  'BUILDARCH',
  'BUILDVARIANT',
  'TARGETPLATFORM',
  'TARGETOS',
  'TARGETARCH',
  'TARGETVARIANT',
  'TARGETSTAGE',
  'BUILDKIT_SYNTAX',
]);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ash', 'ksh', 'fish']);
const SECRET_NAME =
  /(?:^|_)(?:PASSWORD|PASSWD|PASS|SECRET|TOKEN|API_?KEY|APIKEY|PRIVATE_?KEY|ACCESS_?KEY|SECRET_?KEY|CREDENTIALS?|AUTH_?TOKEN)(?:_|$)/;
const NOT_SECRET =
  /_(?:FILE|PATH|DIR|URL|URI|HOST|PORT|USER|USERNAME|NAME|ENDPOINT|LENGTH|TYPE|MODE|ENABLED|HEADER|ID)$/;
const ARCHIVE = /\.(?:tar|tar\.(?:gz|bz2|xz|zst|lz|lzma)|tgz|tbz2?|txz|tzst)$/i;
const REMOTE = /^[a-z][a-z0-9+.-]*:\/\//i;
const STAGE_NAME = /^[A-Za-z][A-Za-z0-9._-]*$/;

interface Stage {
  index: number;
  name?: string;
  image: string;
  line: number;
  base?: Stage;
  user?: { value: string; line: number };
  env: Set<string>;
  pipefail: boolean;
  noRecommends: boolean;
  overridable: Record<'CMD' | 'ENTRYPOINT' | 'HEALTHCHECK', number[]>;
}

const clip = (s: string, max = 60) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function dockerfileLinter(input: string): LintResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const findings: Finding[] = [];
  const report = (rule: RuleId, line: number, message: string) =>
    findings.push({ line, rule, message, severity: RULES[rule].severity, why: RULES[rule].why });

  const parsed = parseDockerfile(input);
  for (const p of parsed.problems) {
    if (p.kind === 'bad-escape') report('XT1003', p.line, `"${clip(p.detail ?? '')}" is not a valid escape character.`);
    else if (p.kind === 'trailing-space')
      report('XT1005', p.line, 'Spaces or tabs follow the line-continuation character.');
    else if (p.kind === 'empty-continuation') report('XT1007', p.line, 'Blank line inside a multi-line instruction.');
    else if (p.kind === 'eof-continuation')
      report('XT1008', p.line, 'The last instruction ends with a line continuation.');
    else report('XT1006', p.line, `The heredoc "${p.detail ?? ''}" is never closed.`);
  }

  const { instructions } = parsed;
  lintCasing(instructions, report);

  const stages: Stage[] = [];
  const byName = new Map<string, Stage>();
  // Every stage name with its line, to recognise references to later stages.
  const declared = new Map<string, number>();
  for (const ins of instructions) {
    const t = ins.keyword === 'FROM' ? ins.rest.split(/\s+/) : [];
    if (t.length === 3 && t[1]!.toLowerCase() === 'as' && !declared.has(t[2]!.toLowerCase())) {
      declared.set(t[2]!.toLowerCase(), ins.line);
    }
  }
  const globalArgs = new Set<string>();
  let stage: Stage | undefined;
  let fromOrderReported = false;
  let previous: Instruction | undefined;
  let runChainReported = false;

  for (const ins of instructions) {
    const prev = previous;
    previous = ins;
    if (!KNOWN.has(ins.keyword)) {
      const suggestion = closest(ins.keyword);
      report(
        'XT1001',
        ins.line,
        `"${clip(ins.raw, 30)}" is not a Dockerfile instruction.${suggestion ? ` Did you mean ${suggestion}?` : ''}`,
      );
      continue;
    }
    if (ins.rest === '' && ins.heredocs.length === 0 && !(ins.keyword === 'HEALTHCHECK' && ins.flags.length)) {
      report('XT1004', ins.line, `${ins.keyword} has no arguments.`);
      continue;
    }
    if (!stage && ins.keyword !== 'FROM' && ins.keyword !== 'ARG' && !fromOrderReported) {
      report('XT1002', ins.line, `${ins.keyword} appears before the first FROM.`);
      fromOrderReported = true;
    }
    if (ins.jsonError && JSON_CAPABLE.has(ins.keyword)) {
      report('XT1803', ins.line, `${ins.keyword} looks like the exec form, but ${ins.jsonError}.`);
    }

    switch (ins.keyword) {
      case 'FROM': {
        if (stage) finishStage(stage, report);
        stage = lintFrom(ins, stages, byName, globalArgs, report);
        break;
      }
      case 'ARG':
        for (const token of splitArgs(ins.rest)) {
          const eq = token.indexOf('=');
          const name = eq < 0 ? token : token.slice(0, eq);
          if (!stage) globalArgs.add(name);
          if (looksSecret(name)) {
            if (eq >= 0 && isLiteral(token.slice(eq + 1))) {
              report('XT2001', ins.line, `ARG ${name} has a default value that looks like a secret.`);
            } else {
              report('XT2002', ins.line, `ARG ${name} looks like a secret; pass it with a secret mount instead.`);
            }
          }
        }
        break;
      case 'ENV':
      case 'LABEL': {
        const tokens = splitArgs(ins.rest);
        const legacy = tokens.length > 0 && !tokens[0]!.includes('=');
        if (legacy) {
          report('XT1202', ins.line, `Write ${ins.keyword} as ${tokens[0]}=value instead of "${tokens[0]} value".`);
        }
        if (ins.keyword === 'LABEL') break;
        const pairs: Array<[string, string]> = legacy
          ? [[tokens[0]!, tokens.slice(1).join(' ')]]
          : tokens.map((t) => {
              const eq = t.indexOf('=');
              return eq < 0 ? [t, ''] : [t.slice(0, eq), t.slice(eq + 1)];
            });
        for (const [name, value] of pairs) {
          stage?.env.add(name);
          if (looksSecret(name) && isLiteral(value)) {
            report('XT2001', ins.line, `ENV ${name} stores what looks like a secret in the image.`);
          }
        }
        break;
      }
      case 'MAINTAINER':
        report('XT1201', ins.line, 'Use LABEL org.opencontainers.image.authors="…" instead of MAINTAINER.');
        break;
      case 'USER':
        if (stage) stage.user = { value: ins.rest.trim(), line: ins.line };
        break;
      case 'WORKDIR': {
        const dir = splitArgs(ins.rest)[0] ?? ins.rest;
        if (!/^(?:[/$~\\]|[A-Za-z]:)/.test(dir)) {
          report('XT1601', ins.line, `WORKDIR "${clip(dir)}" is relative; use an absolute path such as /${clip(dir)}.`);
        }
        break;
      }
      case 'EXPOSE':
        lintExpose(ins, report);
        break;
      case 'COPY':
      case 'ADD':
        lintCopy(ins, stage, byName, declared, report);
        break;
      case 'RUN':
        if (stage) lintRun(ins, stage, report);
        if (stage && prev?.keyword === 'RUN' && mergeable(prev) && mergeable(ins)) {
          if (!runChainReported) {
            report('XT1503', ins.line, `This RUN follows the RUN on line ${prev.line}; consider joining them with &&.`);
          }
          runChainReported = true;
        } else runChainReported = false;
        break;
      case 'CMD':
      case 'ENTRYPOINT':
        if (stage) stage.overridable[ins.keyword].push(ins.line);
        if (!ins.json && !ins.jsonError) {
          report('XT1801', ins.line, `${ins.keyword} uses the shell form; ${execSuggestion(ins.keyword, ins.rest)}`);
        }
        break;
      case 'SHELL':
        if (!ins.json && !ins.jsonError) report('XT1803', ins.line, 'SHELL only accepts the exec form, a JSON array.');
        if (stage && ins.json?.some((a) => a.includes('pipefail'))) stage.pipefail = true;
        break;
      case 'HEALTHCHECK':
        if (stage) stage.overridable.HEALTHCHECK.push(ins.line);
        if (!/^(?:NONE\s*$|CMD\s+\S)/i.test(ins.rest)) {
          report('XT2103', ins.line, 'HEALTHCHECK must be followed by NONE or by CMD and a command.');
        }
        break;
      case 'ONBUILD': {
        const inner = (ins.rest.split(/\s+/)[0] ?? '').toUpperCase();
        if (inner === 'ONBUILD' || inner === 'FROM' || inner === 'MAINTAINER') {
          report('XT2204', ins.line, `ONBUILD ${inner} is not allowed.`);
        }
        break;
      }
    }
    if (ins.keyword !== 'RUN') runChainReported = false;
  }

  if (stage) finishStage(stage, report);
  if (stages.length === 0 && instructions.length > 0 && !fromOrderReported) {
    report('XT1002', instructions[0]!.line, 'There is no FROM instruction.');
  }
  const last = stages.at(-1);
  if (last) {
    const user = effectiveUser(last);
    if (!user) report('XT1301', last.line, 'The final stage never sets USER, so the container runs as root.');
    else if (/^(?:root|0)(?::.*)?$/.test(user.value)) {
      report('XT1302', user.line, `USER ${clip(user.value)} makes the container run as root.`);
    }
    if (!hasHealthcheck(last)) {
      report('XT2101', last.line, 'The final stage has no HEALTHCHECK.');
    }
  }

  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => a.line - b.line || order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule));
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  const truncated = findings.length > MAX_FINDINGS;
  return {
    findings: truncated ? findings.slice(0, MAX_FINDINGS) : findings,
    counts,
    instructions: instructions.length,
    truncated,
  };
}

type Report = (rule: RuleId, line: number, message: string) => void;

function lintCasing(instructions: Instruction[], report: Report) {
  const known = instructions.filter((i) => KNOWN.has(i.keyword));
  const upper = known.filter((i) => i.raw === i.keyword).length;
  const other = known.length - upper;
  if (upper === 0 || other === 0) return;
  const flagUpper = upper < other;
  for (const ins of known) {
    if ((ins.raw === ins.keyword) === flagUpper) {
      report('XT1009', ins.line, `"${ins.raw}" is written in a different case from most instructions in this file.`);
    }
  }
}

function lintFrom(
  ins: Instruction,
  stages: Stage[],
  byName: Map<string, Stage>,
  globalArgs: Set<string>,
  report: Report,
): Stage {
  const tokens = ins.rest.split(/\s+/).filter(Boolean);
  const image = tokens[0] ?? '';
  const stage: Stage = {
    index: stages.length,
    image,
    line: ins.line,
    env: new Set(),
    pipefail: false,
    noRecommends: false,
    overridable: { CMD: [], ENTRYPOINT: [], HEALTHCHECK: [] },
  };
  if (tokens.length === 3 && tokens[1]!.toLowerCase() === 'as') {
    const name = tokens[2]!;
    if (!STAGE_NAME.test(name)) {
      report('XT1105', ins.line, `"${clip(name)}" is not a valid stage name; start it with a letter.`);
    } else if (byName.has(name.toLowerCase())) {
      report(
        'XT1103',
        ins.line,
        `The stage name "${name}" is already used on line ${byName.get(name.toLowerCase())!.line}.`,
      );
    } else {
      stage.name = name;
      byName.set(name.toLowerCase(), stage);
    }
    const as = tokens[1]!;
    const fromUpper = ins.raw === ins.raw.toUpperCase();
    if ((as === as.toUpperCase()) !== fromUpper) {
      report('XT1107', ins.line, `Write "${fromUpper ? 'AS' : 'as'}" to match the casing of ${ins.raw}.`);
    }
  } else if (tokens.length !== 1) {
    report('XT1105', ins.line, 'Expected FROM [--platform=…] image [AS name].');
  }

  const platform = ins.flags.find((f) => f.name === 'platform')?.value;
  if (platform && !platform.includes('$')) {
    report('XT1106', ins.line, `--platform=${clip(platform)} fixes the platform for every build.`);
  }

  for (const m of image.matchAll(/\$\{?([A-Za-z_]\w*)/g)) {
    const name = m[1]!;
    if (!globalArgs.has(name) && !BUILTIN_ARGS.has(name)) {
      report('XT1108', ins.line, `$${name} is not declared by an ARG before the first FROM.`);
    }
  }

  const base = byName.get(image.toLowerCase());
  if (base && base !== stage) stage.base = base;
  else if (image && !image.includes('$') && image.toLowerCase() !== 'scratch' && !image.includes('@')) {
    const last = image.split('/').pop()!;
    const colon = last.indexOf(':');
    if (colon < 0) {
      report('XT1101', ins.line, `"${clip(image)}" has no tag, so it means "${clip(image)}:latest"; pin a version.`);
    } else if (last.slice(colon + 1) === 'latest') {
      report('XT1102', ins.line, `"${clip(image)}" uses the latest tag, which changes over time; pin a version.`);
    }
  }
  stages.push(stage);
  return stage;
}

function finishStage(stage: Stage, report: Report) {
  for (const key of ['CMD', 'ENTRYPOINT', 'HEALTHCHECK'] as const) {
    const lines = stage.overridable[key];
    const last = lines.at(-1);
    for (const line of lines.slice(0, -1)) {
      report('XT1802', line, `This ${key} is replaced by the ${key} on line ${last}.`);
    }
  }
}

function effectiveUser(stage: Stage, depth = 0): Stage['user'] {
  if (stage.user) return stage.user;
  return stage.base && depth < 50 ? effectiveUser(stage.base, depth + 1) : undefined;
}

function hasHealthcheck(stage: Stage, depth = 0): boolean {
  if (stage.overridable.HEALTHCHECK.length) return true;
  return stage.base && depth < 50 ? hasHealthcheck(stage.base, depth + 1) : false;
}

function lintExpose(ins: Instruction, report: Report) {
  for (const token of splitArgs(ins.rest)) {
    if (token.includes('$')) continue;
    const m = /^(\d+)(?:-(\d+))?(?:\/([A-Za-z]+))?$/.exec(token);
    if (!m) {
      const hint = /^\d+:\d+/.test(token) ? ' EXPOSE cannot map host ports; publish them with docker run -p.' : '';
      report('XT1901', ins.line, `"${clip(token)}" is not a valid port.${hint}`);
      continue;
    }
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to > 65535 || from > 65535 || to < from) {
      report('XT1901', ins.line, `Port "${token}" is outside 1–65535 or is not a valid range.`);
    }
    if (m[3] && !['tcp', 'udp', 'sctp'].includes(m[3].toLowerCase())) {
      report('XT1901', ins.line, `"${m[3]}" is not a protocol; use tcp, udp or sctp.`);
    }
  }
}

function lintCopy(
  ins: Instruction,
  stage: Stage | undefined,
  byName: Map<string, Stage>,
  declared: Map<string, number>,
  report: Report,
) {
  const tokens = ins.json ?? splitArgs(ins.rest);
  if (tokens.length < 2) {
    report('XT1004', ins.line, `${ins.keyword} needs at least one source and a destination.`);
    return;
  }
  const dest = tokens.at(-1)!;
  const sources = tokens.slice(0, -1);
  if (sources.length > 1 && !dest.endsWith('/') && !dest.includes('$') && dest !== '.' && dest !== '..') {
    report(
      'XT1703',
      ins.line,
      `${ins.keyword} has ${sources.length} sources, so "${clip(dest)}" must end with a slash.`,
    );
  }

  const from = ins.flags.find((f) => f.name === 'from')?.value;
  if (from && stage && !from.includes('$')) {
    if (/^\d+$/.test(from)) {
      if (Number(from) >= stage.index) {
        report('XT1104', ins.line, `--from=${from} refers to a stage that is not defined above this one.`);
      }
    } else {
      const target = byName.get(from.toLowerCase());
      const later = declared.get(from.toLowerCase());
      if (target === stage) report('XT1104', ins.line, `--from=${from} refers to the stage it is in.`);
      else if (!target && later !== undefined) {
        report('XT1104', ins.line, `--from=${from} refers to a stage defined later, on line ${later}.`);
      } else if (!target && !/[/:@.]/.test(from)) {
        const near = [...byName.values()].find(
          (s) => s.name && distance(s.name.toLowerCase(), from.toLowerCase()) <= 2,
        );
        if (near) report('XT1104', ins.line, `No stage is named "${clip(from)}"; did you mean "${near.name}"?`);
        else
          report('XT1109', ins.line, `No stage is named "${clip(from)}", so the image "${clip(from)}" will be pulled.`);
      }
    }
  }

  if (ins.keyword !== 'ADD') return;
  const local = sources.filter((s) => !s.startsWith('<<') && !REMOTE.test(s) && !s.startsWith('git@'));
  const remote = sources.filter((s) => REMOTE.test(s));
  if (remote.length && !ins.flags.some((f) => f.name === 'checksum') && !remote.every((s) => /\.git(?:#|$)/.test(s))) {
    report('XT1702', ins.line, 'ADD downloads a URL without checking its contents.');
  }
  if ((local.length && !local.every((s) => ARCHIVE.test(s))) || ins.heredocs.length) {
    report('XT1701', ins.line, 'Use COPY for local files; ADD is only needed to extract a local archive.');
  }
}

function mergeable(ins: Instruction): boolean {
  return ins.flags.length === 0 && ins.heredocs.length === 0 && !ins.json;
}

function runScript(ins: Instruction): string {
  let script = ins.rest;
  if (ins.json) {
    const c = ins.json.indexOf('-c');
    script = SHELLS.has((ins.json[0] ?? '').split('/').pop()!) && c >= 0 ? (ins.json[c + 1] ?? '') : ins.json.join(' ');
  }
  for (const h of ins.heredocs) script += `\n${h.body}`;
  return script;
}

function cacheTargets(ins: Instruction): string[] {
  const out: string[] = [];
  for (const f of ins.flags) {
    if (f.name !== 'mount' || !f.value) continue;
    const opts = Object.fromEntries(
      f.value.split(',').map((kv) => {
        const eq = kv.indexOf('=');
        return eq < 0 ? [kv, 'true'] : [kv.slice(0, eq), kv.slice(eq + 1)];
      }),
    );
    if (opts.type === 'cache') out.push(opts.target ?? opts.dst ?? opts.destination ?? '');
  }
  return out;
}

/** The first argument that is not an option (skipping the values of options in `withValue`). */
function subcommand(args: string[], withValue: Set<string> = new Set()): { name: string; index: number } | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('-')) {
      if (withValue.has(a)) i++;
      continue;
    }
    return { name: a, index: i };
  }
  return undefined;
}

const operands = (args: string[]) => args.filter((a) => !a.startsWith('-'));

function lintRun(ins: Instruction, stage: Stage, report: Report) {
  const script = runScript(ins);
  const cmds = simpleCommands(script).map(invocation);
  const programs = cmds.filter((c): c is Invocation => c !== undefined);
  const caches = cacheTargets(ins);
  const cached = (prefix: string) => caches.some((t) => t.startsWith(prefix));
  const removes = (re: RegExp) => programs.some((c) => c.program === 'rm' && c.args.some((a) => re.test(a)));
  if (/Install-Recommends/i.test(script)) stage.noRecommends = true;
  const once = new Set<RuleId>();
  const flag = (rule: RuleId, message: string) => {
    if (once.has(rule)) return;
    once.add(rule);
    report(rule, ins.line, message);
  };

  let aptInstall = false;
  let aptUpdate = false;
  cmds.forEach((cmd, k) => {
    if (!cmd) return;
    const { program, args } = cmd;
    if (cmd.sudo) flag('XT1303', 'sudo is used in RUN; switch users with USER instead.');
    switch (program) {
      case 'cd':
        flag('XT1502', 'Use WORKDIR instead of cd to change directory.');
        break;
      case 'apt':
      case 'apt-get': {
        if (program === 'apt') flag('XT1405', 'Use apt-get instead of apt in scripts.');
        const sub = subcommand(args, new Set(['-o', '-c', '-t', '--option', '--target-release']));
        if (!sub) break;
        if (sub.name === 'update') aptUpdate = true;
        if (['upgrade', 'dist-upgrade', 'full-upgrade'].includes(sub.name)) {
          flag('XT1404', `${program} ${sub.name} upgrades every package in the image.`);
        }
        if (sub.name !== 'install') break;
        aptInstall = true;
        if (
          !args.some(
            (a) => /^(?:-y|--yes|--assume-yes|--force-yes|-qq|-q=2|--quiet=2)$/.test(a) || /^-[a-z]*y[a-z]*$/.test(a),
          )
        ) {
          flag('XT1401', `Add -y to ${program} install so it does not wait for confirmation.`);
        }
        if (!args.includes('--no-install-recommends') && !stage.noRecommends) {
          flag('XT1402', `Add --no-install-recommends to ${program} install.`);
        }
        if (!removes(/^\/var\/lib\/apt\/lists/) && !cached('/var/lib/apt')) {
          flag('XT1403', 'Remove /var/lib/apt/lists/* in the same RUN after installing.');
        }
        break;
      }
      case 'apk': {
        const sub = subcommand(args, new Set(['-X', '--repository', '-p', '--root']));
        if (sub?.name === 'upgrade') flag('XT1404', 'apk upgrade upgrades every package in the image.');
        if (
          sub?.name === 'add' &&
          !args.includes('--no-cache') &&
          !removes(/^\/var\/cache\/apk/) &&
          !cached('/var/cache/apk')
        ) {
          flag('XT1406', 'Add --no-cache to apk add.');
        }
        break;
      }
      case 'yum':
      case 'dnf':
      case 'microdnf':
      case 'zypper': {
        const sub = subcommand(args);
        if (!sub) break;
        const after = args.slice(sub.index + 1);
        const isUpgrade =
          ['upgrade', 'distro-sync', 'dist-upgrade', 'dup'].includes(sub.name) ||
          (['update', 'up'].includes(sub.name) && operands(after).length === 0);
        if (isUpgrade) flag('XT1404', `${program} ${sub.name} upgrades every package in the image.`);
        if (!['install', 'in', 'reinstall'].includes(sub.name)) break;
        const yes =
          program === 'microdnf' ||
          args.some(
            (a) => /^(?:-y|--assumeyes|-n|--non-interactive|--no-confirm)$/.test(a) || /^-[a-zA-Z]*y[a-zA-Z]*$/.test(a),
          );
        if (!yes) flag('XT1408', `Add ${program === 'zypper' ? '-n' : '-y'} to ${program} ${sub.name}.`);
        const cleaned =
          programs.some(
            (c) =>
              ['yum', 'dnf', 'microdnf', 'zypper'].includes(c.program) &&
              c.args.some((a) => a === 'clean' || a === 'cc'),
          ) ||
          removes(/^\/var\/cache\/(?:yum|dnf|zypp|libdnf5)/) ||
          cached('/var/cache/');
        if (!cleaned) flag('XT1407', `Run "${program} clean all" in the same RUN after installing.`);
        break;
      }
      case 'npm': {
        const sub = subcommand(args);
        if (sub && ['install', 'i'].includes(sub.name) && operands(args.slice(sub.index + 1)).length === 0) {
          flag('XT1410', `npm ${sub.name} without package names; npm ci is faster and follows the lockfile exactly.`);
        }
        break;
      }
      case 'curl':
      case 'wget': {
        const next = cmds[k + 1];
        if (next && next.op === '|' && SHELLS.has(next.program)) {
          flag('XT1501', `The output of ${program} is piped straight into ${next.program}.`);
        }
        break;
      }
    }
    const pip =
      program === 'pip' || program === 'pip3' || /^pip3\.\d+$/.test(program)
        ? args
        : /^python[\d.]*$/.test(program) && args[0] === '-m' && /^pip3?$/.test(args[1] ?? '')
          ? args.slice(2)
          : undefined;
    if (pip && subcommand(pip)?.name === 'install' && !pip.includes('--no-cache-dir')) {
      const disabled =
        stage.env.has('PIP_NO_CACHE_DIR') || cached('/root/.cache') || caches.some((t) => t.includes('pip'));
      if (!disabled) flag('XT1409', 'Add --no-cache-dir to pip install.');
    }
  });

  if (aptUpdate && !aptInstall) {
    flag('XT1411', 'apt-get update runs without an install in the same RUN.');
  }
  if (/\b(?:ba|z|da|k)?sh\b[^|\n]*?(?:<\(|\$\()\s*(?:curl|wget)\b/.test(script)) {
    flag('XT1501', 'A downloaded script is run directly by the shell.');
  }
  if (!ins.json && !stage.pipefail && cmds.some((c) => c?.op === '|') && !/pipefail/.test(script)) {
    flag('XT1504', 'This RUN uses a pipe; start it with "set -o pipefail &&" or set SHELL with -o pipefail.');
  }
}

function looksSecret(name: string): boolean {
  const upper = name.toUpperCase();
  return SECRET_NAME.test(upper) && !NOT_SECRET.test(upper);
}

/** A value that is not empty and not just a reference to another variable. */
function isLiteral(value: string): boolean {
  return value !== '' && !/^\$/.test(value);
}

function execSuggestion(keyword: string, rest: string): string {
  if (/[|&;<>$`*?(){}\\]/.test(rest)) {
    return 'prefix the command with exec, or use the JSON exec form so the process receives signals.';
  }
  const words = splitArgs(rest);
  return `use the exec form, e.g. ${keyword} [${words.map((w) => JSON.stringify(w)).join(', ')}].`;
}

function closest(keyword: string): string | undefined {
  if (keyword.length > 14) return undefined;
  let best: string | undefined;
  let bestDistance = 3;
  for (const k of INSTRUCTIONS) {
    const d = distance(keyword, k);
    if (d < bestDistance) {
      best = k;
      bestDistance = d;
    }
  }
  return best;
}

/** Levenshtein distance for short strings. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}
