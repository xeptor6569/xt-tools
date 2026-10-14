// Small filesystem helpers for build scripts.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Recursively lists files under `dir`, as absolute paths. */
export function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out.sort();
}

export function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
