// Shared helpers for repo scripts. Node built-ins only.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = join(import.meta.dirname, '..', '..');
export const TOOLS_DIR = join(ROOT, 'src', 'tools');
export const PAGES_DIR = join(ROOT, 'src', 'pages', 'tools');
export const TEMPLATES_DIR = join(ROOT, 'scripts', 'templates');

export const REQUIRED_FILES = ['meta.ts', 'logic.ts', 'logic.test.ts', 'ui.tsx'] as const;

/** Tool folders under src/tools (every sub-directory is a tool). */
export function listToolIds(): string[] {
  if (!existsSync(TOOLS_DIR)) return [];
  return readdirSync(TOOLS_DIR)
    .filter((name) => statSync(join(TOOLS_DIR, name)).isDirectory())
    .sort();
}

/** Tool pages under src/pages/tools, by id. */
export function listPageIds(): string[] {
  if (!existsSync(PAGES_DIR)) return [];
  return readdirSync(PAGES_DIR)
    .filter((name) => name.endsWith('.astro'))
    .map((name) => name.slice(0, -'.astro'.length))
    .sort();
}

export function toolDir(id: string): string {
  return join(TOOLS_DIR, id);
}

export function pagePath(id: string): string {
  return join(PAGES_DIR, `${id}.astro`);
}

/** Loads a tool's meta.ts default export with Node's built-in type stripping. */
export async function loadMeta(id: string): Promise<unknown> {
  const mod = (await import(pathToFileURL(join(toolDir(id), 'meta.ts')).href)) as { default?: unknown };
  return mod.default;
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

export function toPascalCase(id: string): string {
  return id
    .split('-')
    .map((p) => (p[0] ?? '').toUpperCase() + p.slice(1))
    .join('');
}

export function toCamelCase(id: string): string {
  const pascal = toPascalCase(id);
  return (pascal[0] ?? '').toLowerCase() + pascal.slice(1);
}

export function rel(path: string): string {
  return path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path;
}
