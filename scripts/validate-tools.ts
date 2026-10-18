// Checks every tool against the contract (PLAN.md section 6.2).
// Usage: node scripts/validate-tools.ts [--strict]
//   --strict  Treat warnings (such as leftover XT-TODO markers) as errors.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateMeta } from '../src/tools/validate-meta.ts';
import { REQUIRED_FILES, listPageIds, listToolIds, loadMeta, pagePath, rel, toolDir } from './lib/tools.ts';

const strict = process.argv.includes('--strict');
const errors: string[] = [];
const warnings: string[] = [];

const toolIds = listToolIds();
const pageIds = new Set(listPageIds());
const seenIds = new Map<string, string>();

for (const folder of toolIds) {
  const dir = toolDir(folder);
  const err = (msg: string) => errors.push(`${folder}: ${msg}`);

  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(dir, file))) err(`missing ${rel(join(dir, file))}`);
  }

  // Metadata
  if (existsSync(join(dir, 'meta.ts'))) {
    try {
      const meta = (await loadMeta(folder)) as { id?: unknown } | undefined;
      for (const p of validateMeta(meta, folder)) err(`meta.ts: ${p}`);
      if (typeof meta?.id === 'string') {
        const other = seenIds.get(meta.id);
        if (other) err(`id "${meta.id}" is also used by ${other}`);
        seenIds.set(meta.id, folder);
      }
    } catch (error) {
      err(`meta.ts could not be loaded by Node (use only "import type" there): ${(error as Error).message}`);
    }
  }

  // Page
  const page = pagePath(folder);
  if (!pageIds.has(folder)) {
    err(`missing page ${rel(page)}`);
  } else {
    const src = readFileSync(page, 'utf8');
    const importsFrom = (file: string) =>
      new RegExp(`from\\s+['"]\\.\\./\\.\\./tools/${folder}/${file}(\\.tsx?)?['"]`).test(src);
    if (!importsFrom('ui')) err(`${rel(page)} must import ../../tools/${folder}/ui.tsx`);
    if (!importsFrom('meta')) err(`${rel(page)} must import ../../tools/${folder}/meta.ts`);
    if (!/<ToolLayout\b/.test(src)) err(`${rel(page)} must render <ToolLayout>`);
    if (!/\sclient:(load|idle|visible|media|only)\b/.test(src))
      err(`${rel(page)} must hydrate the tool with a client: directive`);
  }

  // Logic purity
  const logicPath = join(dir, 'logic.ts');
  if (existsSync(logicPath)) {
    const logic = readFileSync(logicPath, 'utf8');
    if (/from\s+['"](preact|preact\/[^'"]*|[^'"]*\.tsx|[^'"]*components\/[^'"]*)['"]/.test(logic)) {
      err('logic.ts must not import Preact, .tsx files or UI components');
    }
  }

  // Tests
  const testPath = join(dir, 'logic.test.ts');
  if (existsSync(testPath) && !/\b(it|test)\s*\(/.test(readFileSync(testPath, 'utf8'))) {
    err('logic.test.ts must contain at least one test');
  }

  // Sensitive tools never put input in the URL or in storage.
  try {
    const meta = (await loadMeta(folder)) as { sensitive?: boolean } | undefined;
    if (meta?.sensitive) {
      for (const file of readdirSync(dir)) {
        if (!/\.(ts|tsx)$/.test(file)) continue;
        const source = readFileSync(join(dir, file), 'utf8');
        for (const banned of ['useShareableState', 'ShareButton', 'usePersistentState', 'RememberToggle']) {
          if (source.includes(banned)) err(`${file}: sensitive tools must not use ${banned}`);
        }
      }
    }
  } catch {
    // Already reported above.
  }

  // Leftover scaffolding markers
  for (const file of readdirSync(dir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const count = readFileSync(join(dir, file), 'utf8').split('XT-TODO').length - 1;
    if (count > 0) warnings.push(`${folder}: ${file} has ${count} XT-TODO marker(s)`);
  }
  if (pageIds.has(folder) && readFileSync(page, 'utf8').includes('XT-TODO')) {
    warnings.push(`${folder}: ${rel(page)} has XT-TODO marker(s)`);
  }
}

for (const id of pageIds) {
  if (!toolIds.includes(id)) errors.push(`${id}: page ${rel(pagePath(id))} has no tool folder src/tools/${id}/`);
}

const problems = strict ? [...errors, ...warnings] : errors;
if (!strict) for (const w of warnings) console.warn(`warning: ${w}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`validate-tools: ${toolIds.length} tool(s) OK${strict ? ' (strict)' : ''}.`);
