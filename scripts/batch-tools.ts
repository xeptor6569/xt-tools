// Creates many tools from a JSON spec, using the same rules as new-tool.
// Everything is validated before anything is written.
//
// Usage: node scripts/batch-tools.ts <spec.json> [--skip-existing] [--only a,b] [--dry-run]
//
// The spec is an array of objects:
//   { "id", "name", "category", "description", "keywords": [], "template"?,
//     "group"?, "requires"?: [], "sensitive"?, "heavy"?, "worker"? }
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { validateMeta } from '../src/tools/validate-meta.ts';
import { pagePath, ROOT, TEMPLATES_DIR, toolDir } from './lib/tools.ts';

interface Entry {
  id: string;
  name: string;
  category: string;
  group?: string;
  description: string;
  keywords: string[];
  template?: string;
  requires?: string[];
  sensitive?: boolean;
  heavy?: boolean;
  worker?: boolean;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'skip-existing': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    only: { type: 'string' },
  },
});

const specPath = positionals[0];
if (!specPath) {
  console.error('Usage: npm run batch-tools -- <spec.json> [--skip-existing] [--dry-run]');
  process.exit(1);
}

let entries: Entry[];
try {
  entries = JSON.parse(readFileSync(resolve(specPath), 'utf8')) as Entry[];
  if (!Array.isArray(entries)) throw new Error('the spec must be a JSON array');
} catch (error) {
  console.error(`Can't read ${specPath}: ${(error as Error).message}`);
  process.exit(1);
}

const only = values.only ? new Set(values.only.split(',').map((s) => s.trim())) : undefined;
if (only) {
  const unknown = [...only].filter((id) => !entries.some((e) => e?.id === id));
  if (unknown.length) {
    console.error(`batch-tools: --only lists ids that aren't in the spec: ${unknown.join(', ')}`);
    process.exit(1);
  }
  entries = entries.filter((e) => only.has(e.id));
}

const templates = readdirSync(TEMPLATES_DIR).filter((t) => !t.startsWith('_'));
const today = new Date().toISOString().slice(0, 10);
const problems: string[] = [];
const seen = new Set<string>();
const toCreate: Entry[] = [];

for (const [i, e] of entries.entries()) {
  const where = `entry ${i + 1}${e?.id ? ` (${e.id})` : ''}`;
  if (typeof e !== 'object' || e === null) {
    problems.push(`${where}: must be an object`);
    continue;
  }
  if (seen.has(e.id)) problems.push(`${where}: id is listed twice`);
  seen.add(e.id);
  const template = e.template ?? 'two-pane';
  if (!templates.includes(template)) problems.push(`${where}: unknown template "${template}"`);
  if (e.worker && !existsSync(join(TEMPLATES_DIR, template, 'ui.worker.tsx.tmpl'))) {
    problems.push(`${where}: template "${template}" has no worker variant`);
  }
  const meta: Record<string, unknown> = {
    id: e.id,
    name: e.name,
    description: e.description,
    category: e.category,
    ...(e.group ? { group: e.group } : {}),
    keywords: e.keywords,
    added: today,
  };
  if (e.requires?.length) meta.requires = e.requires;
  for (const p of validateMeta(meta, e.id)) problems.push(`${where}: ${p}`);

  const exists = typeof e.id === 'string' && (existsSync(toolDir(e.id)) || existsSync(pagePath(e.id)));
  if (exists && !values['skip-existing']) problems.push(`${where}: already exists (use --skip-existing)`);
  if (!exists) toCreate.push(e);
}

if (problems.length > 0) {
  console.error(`batch-tools: ${problems.length} problem(s); nothing was created:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`batch-tools: ${toCreate.length} to create, ${entries.length - toCreate.length} already exist.`);
if (values['dry-run']) {
  for (const e of toCreate) console.log(`  would create ${e.id} (${e.template ?? 'two-pane'})`);
  process.exit(0);
}

for (const e of toCreate) {
  const args = [
    join(ROOT, 'scripts', 'new-tool.ts'),
    e.id,
    '--name',
    e.name,
    '--category',
    e.category,
    ...(e.group ? ['--group', e.group] : []),
    '--description',
    e.description,
    '--keywords',
    e.keywords.join(','),
    '--template',
    e.template ?? 'two-pane',
    '--yes',
    ...(e.requires?.length ? ['--requires', e.requires.join(',')] : []),
    ...(e.sensitive ? ['--sensitive'] : []),
    ...(e.heavy ? ['--heavy'] : []),
    ...(e.worker ? ['--worker'] : []),
  ];
  execFileSync(process.execPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(`  + ${e.id}`);
}
