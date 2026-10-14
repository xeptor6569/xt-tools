// Loads tool metadata straight from src/tools/*/meta.ts, so every new tool is
// covered without editing the tests.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ToolMeta } from '../../src/tools/types.ts';

const TOOLS_DIR = join(import.meta.dirname, '..', '..', 'src', 'tools');

export async function loadTools(): Promise<ToolMeta[]> {
  const ids = readdirSync(TOOLS_DIR).filter((name) => statSync(join(TOOLS_DIR, name)).isDirectory());
  const tools: ToolMeta[] = [];
  for (const id of ids.sort()) {
    const mod = (await import(pathToFileURL(join(TOOLS_DIR, id, 'meta.ts')).href)) as { default: ToolMeta };
    tools.push(mod.default);
  }
  return tools;
}
