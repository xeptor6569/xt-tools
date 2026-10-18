// Per-page JavaScript budget (PLAN.md section 11). For every built page,
// follows the scripts, module preloads and island component/renderer URLs,
// then every static import inside those chunks, and sums their gzipped size.
// Dynamic import() and Web Workers load on demand, so they don't count.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { walk } from './lib/fs.ts';
import { listToolIds, loadMeta, ROOT } from './lib/tools.ts';

const DIST = join(ROOT, 'dist');
export const BUDGET_BYTES = 150 * 1024;

const basePath = process.env.BASE_PATH ?? '/';
const gz = (data: string | Buffer) => gzipSync(data, { level: 9 }).length;

/** Maps a URL path from the HTML to a file in dist/. */
function toFile(url: string): string | undefined {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:')) return undefined;
  const path = url.split(/[?#]/)[0] ?? '';
  const rel = path.startsWith(basePath) ? path.slice(basePath.length) : path.replace(/^\//, '');
  const file = join(DIST, rel);
  return existsSync(file) ? file : undefined;
}

const STATIC_IMPORT = /(?:^|[;\s}])(?:import|export)\s*(?:[\w$*\s{},]*?\s*from\s*)?["']([^"']+)["']/g;

export function staticImports(code: string): string[] {
  return [...code.matchAll(STATIC_IMPORT)].map((m) => m[1] ?? '').filter(Boolean);
}

function chunkGraph(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of staticImports(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
      const next = spec.startsWith('/') ? toFile(spec) : join(dirname(file), spec);
      if (next && existsSync(next) && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

export interface PageBudget {
  page: string;
  bytes: number;
  files: number;
  heavy: boolean;
}

export async function measure(): Promise<PageBudget[]> {
  const heavyIds = new Set<string>();
  for (const id of listToolIds()) {
    const meta = (await loadMeta(id)) as { heavy?: boolean };
    if (meta.heavy) heavyIds.add(id);
  }

  const results: PageBudget[] = [];
  for (const htmlFile of walk(DIST).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(htmlFile, 'utf8');
    const urls = [
      ...[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/\s(?:component|renderer|before-hydration)-url="([^"]+)"/g)].map((m) => m[1]),
    ].filter((u): u is string => !!u);
    const entries = urls.map(toFile).filter((f): f is string => !!f && /\.m?js$/.test(f));
    const graph = chunkGraph(entries);
    const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
    const bytes = [...graph].reduce((sum, f) => sum + gz(readFileSync(f)), 0) + inline.reduce((s, c) => s + gz(c), 0);
    const page = posix.join('/', relative(DIST, htmlFile).split('\\').join('/')).replace(/index\.html$/, '');
    const toolId = /^\/tools\/([^/]+)\/$/.exec(page)?.[1];
    results.push({ page, bytes, files: graph.size, heavy: !!toolId && heavyIds.has(toolId) });
  }
  return results.sort((a, b) => b.bytes - a.bytes);
}

if (import.meta.main) {
  const results = await measure();
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  const over = results.filter((r) => r.bytes > BUDGET_BYTES && !r.heavy);
  mkdirSync(join(ROOT, 'build'), { recursive: true });
  writeFileSync(join(ROOT, 'build', 'budget.json'), `${JSON.stringify(results, null, 2)}\n`);
  for (const r of results.slice(0, 8)) {
    console.log(
      `  ${kb(r.bytes).padStart(9)}  ${String(r.files).padStart(3)} chunk(s)  ${r.page}${r.heavy ? '  (heavy: exempt)' : ''}`,
    );
  }
  if (over.length > 0) {
    console.error(`check-budget: ${over.length} page(s) over ${kb(BUDGET_BYTES)} of gzipped JavaScript:`);
    for (const r of over) console.error(`  - ${r.page}: ${kb(r.bytes)}`);
    console.error('Lazy-load heavy dependencies with import(), or flag the tool as heavy.');
    process.exit(1);
  }
  const max = results.find((r) => !r.heavy);
  console.log(`check-budget: ${results.length} page(s) within ${kb(BUDGET_BYTES)} (largest ${kb(max?.bytes ?? 0)}).`);
}
