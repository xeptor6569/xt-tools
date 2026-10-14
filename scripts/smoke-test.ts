// Smoke-tests a built image the way it is deployed: read-only root
// filesystem, all capabilities dropped, no new privileges.
// Usage: node scripts/smoke-test.ts [--image xt-tools:local] [--base /tools/] [--keep]
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { listToolIds } from './lib/tools.ts';

const { values } = parseArgs({
  options: {
    image: { type: 'string', default: 'xt-tools:local' },
    base: { type: 'string', default: process.env.BASE_PATH ?? '/' },
    keep: { type: 'boolean', default: false },
  },
});
const image = values.image;
const base = values.base;

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

const id = docker(
  'run',
  '-d',
  '--read-only',
  '--tmpfs',
  '/tmp',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '-p',
  '127.0.0.1::8080',
  image,
);

try {
  const port = docker('port', id, '8080/tcp').split('\n')[0]?.split(':').pop();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`Container ${id.slice(0, 12)} from ${image} on ${origin} (base ${base})`);

  let health = '';
  for (let i = 0; i < 60 && health !== 'healthy'; i++) {
    await sleep(1000);
    health = docker('inspect', '--format', '{{.State.Health.Status}}', id);
    if (health === 'unhealthy') break;
  }
  check(health === 'healthy', `container is healthy (status: ${health})`);

  const get = (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, { redirect: 'manual', ...init });

  const healthz = await get('/healthz');
  check(healthz.status === 200 && (await healthz.text()).trim() === 'ok', '/healthz returns ok');

  const expected = /add_header Content-Security-Policy "([^"]+)"/.exec(
    docker('exec', id, 'cat', '/etc/nginx/snippets/csp.conf'),
  )?.[1];
  const home = await get(base);
  const html = await home.text();
  const header = home.headers.get('content-security-policy') ?? '';
  check(home.status === 200, `${base} returns 200`);
  check(!!expected && header === expected, 'CSP header equals the generated policy');
  check(header.includes("frame-ancestors 'self'"), 'CSP header includes frame-ancestors');
  const meta = /http-equiv="content-security-policy" content="([^"]+)"/.exec(html)?.[1]?.replace(/&#39;/g, "'") ?? '';
  const missing = (meta.match(/'sha(256|384|512)-[^']+'/g) ?? []).filter((h) => !header.includes(h));
  check(meta !== '' && missing.length === 0, 'every hash in the page CSP is in the header');
  check(home.headers.get('x-content-type-options') === 'nosniff', 'nosniff header');
  check(home.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options header');
  check(home.headers.get('referrer-policy') === 'no-referrer', 'Referrer-Policy header');
  check((home.headers.get('permissions-policy') ?? '').includes('geolocation=()'), 'Permissions-Policy header');
  check(home.headers.get('cache-control') === 'no-cache', 'HTML is served with no-cache');
  check(!/\d/.test(home.headers.get('server') ?? ''), 'Server header hides the version');
  check(home.headers.get('content-encoding') === 'gzip', 'HTML is served gzip-compressed');

  const tool = listToolIds()[0];
  let toolHtml = '';
  if (tool) {
    const deep = await get(`${base}tools/${tool}/`);
    toolHtml = await deep.text();
    check(deep.status === 200 && toolHtml.includes('<h1'), `deep link ${base}tools/${tool}/ loads`);
    const noSlash = await get(`${base}tools/${tool}`);
    const location = noSlash.headers.get('location') ?? '';
    check(
      noSlash.status === 301 && location === `${base}tools/${tool}/`,
      `missing trailing slash redirects to a relative URL (got ${noSlash.status} ${location})`,
    );
  }

  const asset = /(?:src|href)="([^"]*\/_astro\/[^"]+\.(?:js|css))"/.exec(toolHtml + html)?.[1];
  check(!!asset, 'found a hashed asset to check');
  if (asset) {
    const r = await get(asset);
    check((r.headers.get('cache-control') ?? '').includes('immutable'), 'hashed assets are cached immutably');
    check(!!r.headers.get('content-security-policy'), 'assets also carry the CSP header (workers need it)');
  }

  const missingPage = await get(`${base}no-such-page/`);
  check(
    missingPage.status === 404 && (await missingPage.text()).includes('Page not found'),
    'unknown pages return the custom 404',
  );

  const dotfile = await get(`${base}.env`);
  check(dotfile.status === 404, 'dotfiles are not served');

  if (base !== '/') {
    const root = await get('/');
    check(root.status === 302 && root.headers.get('location') === base, `/ redirects to ${base}`);
  }

  const logs = docker('logs', id);
  check(!/\[(emerg|alert|crit|error)\]/.test(logs), 'nginx logged no errors');
} finally {
  if (values.keep) console.log(`Kept container ${id}`);
  else docker('rm', '-f', id);
}

if (failures.length > 0) {
  console.error(`\nSmoke test failed: ${failures.length} check(s).`);
  process.exit(1);
}
console.log('\nSmoke test passed.');
