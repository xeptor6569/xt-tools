// Auto-discovers every tool's metadata at build time. There is no central list.
import { categories } from '../categories.ts';
import type { ToolMeta } from './types.ts';
import { validateMeta } from './validate-meta.ts';

const modules = import.meta.glob<ToolMeta>('./*/meta.ts', { eager: true, import: 'default' });

const tools: ToolMeta[] = Object.entries(modules).map(([path, meta]) => {
  const folder = path.split('/')[1] ?? '';
  const problems = validateMeta(meta, folder);
  if (problems.length > 0) {
    throw new Error(`Invalid metadata in src/tools/${folder}/meta.ts:\n  - ${problems.join('\n  - ')}`);
  }
  return meta;
});

tools.sort((a, b) => a.name.localeCompare(b.name, 'en'));

/** How long a tool shows the "New" badge. */
export const NEW_FOR_DAYS = 30;

export function allTools(): readonly ToolMeta[] {
  return tools;
}

export function getTool(id: string): ToolMeta | undefined {
  return tools.find((t) => t.id === id);
}

export function toolsInCategory(categoryId: string): ToolMeta[] {
  return tools.filter((t) => t.category === categoryId);
}

export function toolsByCategory() {
  return categories.map((category) => ({ category, tools: toolsInCategory(category.id) }));
}

export function isNew(tool: ToolMeta, now = new Date()): boolean {
  const ageMs = now.getTime() - Date.parse(tool.added);
  return ageMs >= 0 && ageMs <= NEW_FOR_DAYS * 24 * 3600 * 1000;
}
