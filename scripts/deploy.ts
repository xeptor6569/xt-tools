// Builds the production image and (re)deploys it with docker compose on this
// machine. Used by the CI deploy job on the self-hosted runner and by
// `make deploy`. Node built-ins only (D17).
//
// Usage: node scripts/deploy.ts [--tag sha-abc1234] [--no-build] [--dry-run]
//
// Settings (environment variables, all optional):
//   XT_PORT        host port                         default 3125
//   XT_BIND        host address                      default 0.0.0.0
//   BASE_PATH      sub-path, compiled into the image default /
//   SITE_URL       public URL for canonical links    default empty
//   XT_DEPLOY_DIR  where compose.yaml and .env live  default ~/xt-tools
//   XT_PROJECT     docker compose project name       default xt-tools-prod
//
// The deploy directory survives runner workspace cleanups, so the site can be
// managed by hand there: `docker compose -p xt-tools-prod logs -f`.
// If the new container doesn't become healthy and serve the site, the
// previous image is started again and the script fails.
import { execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/tools.ts';

const IMAGE = 'xt-tools';
const KEEP_TAG_FILE = '.deployed-tag';

const { values } = parseArgs({
  options: {
    tag: { type: 'string' },
    'no-build': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const env = process.env;
const port = env.XT_PORT || '3125';
const bind = env.XT_BIND || '0.0.0.0';
const basePath = env.BASE_PATH || '/';
const siteUrl = env.SITE_URL || '';
const dir = env.XT_DEPLOY_DIR || join(homedir(), 'xt-tools');
const project = env.XT_PROJECT || 'xt-tools-prod';

const problems: string[] = [];
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  problems.push(`XT_PORT "${port}" is not a port`);
if (!basePath.startsWith('/') || !basePath.endsWith('/'))
  problems.push(`BASE_PATH "${basePath}" must start and end with /`);
if (!/^[a-z0-9][a-z0-9_-]*$/.test(project))
  problems.push(`XT_PROJECT "${project}" is not a valid compose project name`);
if (problems.length) fail(problems.join('\n'));

const sha = git('rev-parse', 'HEAD');
const tag = values.tag ?? `sha-${sha.slice(0, 7)}`;
if (!/^[\w][\w.-]{0,127}$/.test(tag)) fail(`--tag "${tag}" is not a valid image tag`);

const compose = (...args: string[]) =>
  run('docker', ['compose', '-p', project, '-f', join(dir, 'compose.yaml'), ...args]);

console.log(`deploy: ${IMAGE}:${tag} → ${dir} (project ${project}, ${bind}:${port}, base ${basePath})`);
if (values['dry-run']) process.exit(0);

if (!values['no-build']) {
  run('docker', [
    'build',
    '-t',
    `${IMAGE}:${tag}`,
    '--build-arg',
    `BASE_PATH=${basePath}`,
    '--build-arg',
    `SITE_URL=${siteUrl}`,
    '--build-arg',
    `VERSION=edge-${sha.slice(0, 7)}`,
    '--build-arg',
    `REVISION=${sha}`,
    '--build-arg',
    `CREATED=${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`,
    ROOT,
  ]);
}

mkdirSync(dir, { recursive: true });
copyFileSync(join(ROOT, 'compose.yaml'), join(dir, 'compose.yaml'));
const tagFile = join(dir, KEEP_TAG_FILE);
const previous = existsSync(tagFile) ? readFileSync(tagFile, 'utf8').trim() : '';

const host = bind === '0.0.0.0' || bind === '::' ? '127.0.0.1' : bind.includes(':') ? `[${bind}]` : bind;
const localUrl = `http://${host}:${port}`;

try {
  await up(tag);
} catch (error) {
  console.error(`deploy: ${(error as Error).message}`);
  if (previous && previous !== tag && imageExists(previous)) {
    console.error(`deploy: rolling back to ${IMAGE}:${previous}`);
    await up(previous).catch((e: unknown) => console.error(`deploy: rollback failed too: ${(e as Error).message}`));
  }
  fail(`deploy of ${IMAGE}:${tag} failed`);
}

writeFileSync(tagFile, `${tag}\n`);
pruneImages([tag, previous]);

const publicUrl = siteUrl || `http://${hostname()}:${port}${basePath}`;
console.log(`deploy: ${IMAGE}:${tag} is live at ${publicUrl}`);
if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `url=${publicUrl}\ntag=${tag}\n`);
if (env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    env.GITHUB_STEP_SUMMARY,
    `### Deployed \`${IMAGE}:${tag}\`\n\n- URL: ${publicUrl}\n- Host: \`${hostname()}\`, ${bind}:${port}, base \`${basePath}\`\n- Directory: \`${dir}\`, project \`${project}\`\n${previous && previous !== tag ? `- Previous: \`${previous}\`\n` : ''}`,
  );
}

async function up(imageTag: string): Promise<void> {
  const lines = [
    '# Written by scripts/deploy.ts on every deploy. Change the GitHub repository',
    '# variables (or the environment of `make deploy`) instead of editing this file.',
    `XT_IMAGE=${IMAGE}`,
    `XT_TAG=${imageTag}`,
    `XT_BIND=${bind}`,
    `XT_PORT=${port}`,
    `BASE_PATH=${basePath}`,
    `SITE_URL=${siteUrl}`,
  ];
  writeFileSync(join(dir, '.env'), `${lines.join('\n')}\n`);
  compose('up', '-d', '--no-build', '--pull', 'never', '--remove-orphans', '--wait', '--wait-timeout', '90');
  // The container is healthy; check the host port really serves the site.
  for (const path of ['/healthz', basePath]) {
    const response = await get(`${localUrl}${path}`);
    if (response !== 200) throw new Error(`${localUrl}${path} answered ${response || 'nothing'}, expected 200`);
  }
}

async function get(url: string): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      return response.status;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return 0;
}

function imageExists(imageTag: string): boolean {
  try {
    execFileSync('docker', ['image', 'inspect', `${IMAGE}:${imageTag}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Keeps the live and previous images (for rollback); removes older deploy images. */
function pruneImages(keep: string[]): void {
  const tags = execFileSync('docker', ['image', 'ls', IMAGE, '--format', '{{.Tag}}'], { encoding: 'utf8' })
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t.startsWith('sha-') && !keep.includes(t));
  for (const t of tags) {
    try {
      execFileSync('docker', ['image', 'rm', `${IMAGE}:${t}`], { stdio: 'ignore' });
      console.log(`deploy: removed old image ${IMAGE}:${t}`);
    } catch {
      // Still used by something else: leave it.
    }
  }
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function run(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
}

function fail(message: string): never {
  console.error(`deploy: ${message}`);
  process.exit(1);
}
