// Scaffolds a new tool. Node built-ins only.
// Run `npm run new-tool -- --help` for usage.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { categories, categoryIds } from '../src/categories.ts';
import { capabilityIds } from '../src/capabilities.ts';
import { ID_PATTERN, validateMeta } from '../src/tools/validate-meta.ts';
import { ROOT, TEMPLATES_DIR, pagePath, rel, slugify, toCamelCase, toPascalCase, toolDir } from './lib/tools.ts';

const HELP = `Scaffold a new tool.

Usage:
  npm run new-tool -- [id] [options]

Options:
  --name <text>          Display name (default: derived from the id)
  --category <id>        One of: ${categoryIds.join(', ')}
  --description <text>   One sentence, 20–160 characters, ending with a period
  --keywords <a,b,c>     Comma-separated search keywords (default: words of the name)
  --requires <a,b>       Capabilities: ${capabilityIds.join(', ')}
  --sensitive            The tool handles secrets (no URL state or persistence)
  --heavy                The tool lazy-loads WASM or large data
  --worker               Also scaffold a Web Worker
  --template <name>      Template (default: two-pane)
  --yes, -y              Accept defaults and never prompt (for CI)
  --help, -h             Show this help

Examples:
  npm run new-tool
  npm run new-tool -- jwt-debugger --name "JWT debugger" --category crypto \\
    --description "Decode, sign and verify JSON Web Tokens." --keywords "jwt,token" --sensitive --yes
`;

function fail(message: string): never {
  console.error(`\nError: ${message}\n`);
  process.exit(1);
}

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      name: { type: 'string' },
      category: { type: 'string' },
      description: { type: 'string' },
      keywords: { type: 'string' },
      requires: { type: 'string' },
      sensitive: { type: 'boolean', default: false },
      heavy: { type: 'boolean', default: false },
      worker: { type: 'boolean', default: false },
      template: { type: 'string', default: 'two-pane' },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (error) {
  fail(`${(error as Error).message}\n\n${HELP}`);
}

const { values: opts, positionals } = parsed;
if (opts.help) {
  console.log(HELP);
  process.exit(0);
}
if (positionals.length > 1) fail(`expected at most one tool id, got: ${positionals.join(' ')}`);

const interactive = !opts.yes && process.stdin.isTTY === true;
const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;

async function ask(question: string, fallback?: string): Promise<string> {
  if (!rl) return fallback ?? '';
  const suffix = fallback ? ` (${fallback})` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback || '';
}

function titleFromId(id: string): string {
  const words = id.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- Gather inputs --------------------------------------------------------

const templates = existsSync(TEMPLATES_DIR) ? readdirSync(TEMPLATES_DIR) : [];
if (!templates.includes(opts.template)) {
  fail(`unknown template "${opts.template}". Available: ${templates.join(', ')}`);
}

let id = positionals[0];
let name = opts.name;

if (!id && !name) {
  if (!interactive) fail('give a tool id or --name');
  name = await ask('Tool name, e.g. "JWT debugger"');
  if (!name) fail('a name is required');
}
if (!name) name = interactive ? await ask('Tool name', titleFromId(id ?? '')) : titleFromId(id ?? '');
if (!id) id = interactive ? await ask('Tool id', slugify(name)) : slugify(name);

if (!ID_PATTERN.test(id) || id.length < 2 || id.length > 40) {
  fail(`invalid id "${id}". Use kebab-case (lowercase letters, digits and single hyphens), 2–40 characters.`);
}
if (existsSync(toolDir(id)) || existsSync(pagePath(id))) {
  fail(`a tool with id "${id}" already exists (${rel(toolDir(id))} or ${rel(pagePath(id))}).`);
}

let category = opts.category;
if (!category && interactive) {
  console.log('\nCategories:');
  for (const c of categories) console.log(`  ${c.id.padEnd(14)} ${c.label}`);
  category = await ask('Category');
}
if (!category) fail(`--category is required. Valid categories: ${categoryIds.join(', ')}`);
if (!categoryIds.includes(category))
  fail(`unknown category "${category}". Valid categories: ${categoryIds.join(', ')}`);

let description = opts.description;
if (!description && interactive) description = await ask('One-sentence description (20–160 characters)');
if (!description) description = `${name}: XT-TODO describe what this tool does.`;

let keywords = splitList(opts.keywords);
if (keywords.length === 0) {
  const fallback = [
    ...new Set(
      name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1),
    ),
  ].join(',');
  keywords = splitList(interactive ? await ask('Keywords, comma-separated', fallback) : fallback);
}
keywords = [...new Set(keywords.map((k) => k.toLowerCase()))];

const requires = splitList(opts.requires);
for (const r of requires) {
  if (!capabilityIds.includes(r)) fail(`unknown capability "${r}". Valid: ${capabilityIds.join(', ')}`);
}

rl?.close();

const toolId = id;
const toolName = name;

// ---- Build files -----------------------------------------------------------

const added = new Date().toISOString().slice(0, 10);
const meta: Record<string, unknown> = { id: toolId, name: toolName, description, category, keywords, added };
if (opts.sensitive) meta.sensitive = true;
if (requires.length > 0) meta.requires = requires;
if (opts.heavy) meta.heavy = true;

const problems = validateMeta(meta, toolId);
if (problems.length > 0) fail(`invalid metadata:\n  - ${problems.join('\n  - ')}`);

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const lit = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map((x) => lit(x)).join(', ')}]` : typeof v === 'string' ? quote(v) : String(v);

const metaSource = `import type { ToolMeta } from '../types.ts';

export default {
${Object.entries(meta)
  .map(([k, v]) => `  ${k}: ${lit(v)},`)
  .join('\n')}
} satisfies ToolMeta;
`;

const fnName = /^\d/.test(toolId) ? `run${toPascalCase(toolId)}` : toCamelCase(toolId);
const componentName = `${/^\d/.test(toolId) ? 'Tool' : ''}${toPascalCase(toolId)}Tool`;

function render(file: string): string {
  return readFileSync(join(TEMPLATES_DIR, opts.template, file), 'utf8')
    .replaceAll('__ID__', toolId)
    .replaceAll('__NAME__', toolName)
    .replaceAll('__FN__', fnName)
    .replaceAll('__COMPONENT__', componentName);
}

const dir = toolDir(toolId);
const files: Array<[string, string]> = [
  [join(dir, 'meta.ts'), metaSource],
  [join(dir, 'logic.ts'), render('logic.ts.tmpl')],
  [join(dir, 'logic.test.ts'), render('logic.test.ts.tmpl')],
  [join(dir, 'ui.tsx'), render(opts.worker ? 'ui.worker.tsx.tmpl' : 'ui.tsx.tmpl')],
  ...(opts.worker ? ([[join(dir, 'worker.ts'), render('worker.ts.tmpl')]] as Array<[string, string]>) : []),
  [pagePath(toolId), render('page.astro.tmpl')],
];

const existing = files.filter(([path]) => existsSync(path));
if (existing.length > 0) fail(`refusing to overwrite:\n  ${existing.map(([p]) => rel(p)).join('\n  ')}`);

for (const [path, content] of files) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { flag: 'wx' });
}

// Format with the project's Prettier config when it is installed.
const prettier = join(ROOT, 'node_modules', '.bin', 'prettier');
if (existsSync(prettier)) {
  try {
    execFileSync(prettier, ['--write', '--log-level', 'warn', ...files.map(([p]) => p)], {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch {
    console.warn('Prettier failed; run `npm run format` before committing.');
  }
}

console.log(`\nCreated tool "${toolId}":`);
for (const [path] of files) console.log(`  + ${rel(path)}`);
console.log(`
Next steps:
  1. Implement the logic in ${rel(join(dir, 'logic.ts'))} and replace every XT-TODO.
  2. Run its tests:        npx vitest ${rel(dir)}
  3. Try it:               npm run dev, then open http://localhost:4321/tools/${toolId}/
  4. Validate the tool:    npm run validate-tools
`);
