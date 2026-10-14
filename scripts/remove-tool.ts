// Deletes a tool folder and its page together.
// Usage: node scripts/remove-tool.ts <id> [--yes]
import { existsSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { ID_PATTERN } from '../src/tools/validate-meta.ts';
import { pagePath, rel, toolDir } from './lib/tools.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { yes: { type: 'boolean', short: 'y', default: false } },
});

const id = positionals[0];
if (!id || positionals.length > 1 || !ID_PATTERN.test(id)) {
  console.error('Usage: npm run remove-tool -- <id> [--yes]');
  process.exit(1);
}

const targets = [toolDir(id), pagePath(id)].filter((p) => existsSync(p));
if (targets.length === 0) {
  console.error(`No tool "${id}" found.`);
  process.exit(1);
}

if (!values.yes) {
  if (!process.stdin.isTTY) {
    console.error('Refusing to delete without confirmation. Pass --yes.');
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Delete ${targets.map(rel).join(' and ')}? [y/N] `);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log('Cancelled.');
    process.exit(0);
  }
}

for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  console.log(`  - ${rel(target)}`);
}
console.log(`Removed tool "${id}".`);
