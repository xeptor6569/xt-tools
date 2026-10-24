// Prints the registry grouped by category, with counts.
// Usage: node scripts/list-tools.ts [--json]
import { categories } from '../src/categories.ts';
import type { ToolMeta } from '../src/tools/types.ts';
import { listToolIds, loadMeta } from './lib/tools.ts';

const tools: ToolMeta[] = [];
for (const id of listToolIds()) tools.push((await loadMeta(id)) as ToolMeta);
tools.sort((a, b) => a.name.localeCompare(b.name, 'en'));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(tools, null, 2));
  process.exit(0);
}

for (const c of categories) {
  const inCategory = tools.filter((t) => t.category === c.id);
  console.log(`\n${c.label} (${inCategory.length})`);
  for (const t of inCategory) {
    const flags = [t.group, t.sensitive && 'sensitive', t.heavy && 'heavy', ...(t.requires ?? [])].filter(Boolean);
    console.log(`  ${t.id.padEnd(28)} ${t.name}${flags.length ? `  [${flags.join(', ')}]` : ''}`);
  }
}
console.log(`\nTotal: ${tools.length} tool(s)`);
