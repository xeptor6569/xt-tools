// Classifies the built site into the precache (shell) and the heavy-asset
// manifest (lazy chunks, WASM, datasets). scripts/gen-sw.ts writes both.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { walk } from './lib/fs.ts';
import { staticImports } from './check-budget.ts';

const PRECACHE_EXT = /\.(html|css|svg|png|ico|webp|webmanifest|woff2)$/;

export function readBasePath(env = process.env.BASE_PATH): string {
  const base = env ?? '/';
  if (!base.startsWith('/') || !base.endsWith('/')) {
    throw new Error(`BASE_PATH must start and end with "/" (got "${base}")`);
  }
  return base;
}

export function siteUrl(basePath: string, rel: string): string {
  return basePath + rel.replace(/^\/+/, '');
}

/**
 * Runtime cache for lazy files the precache does not own.
 * Workbox tests a RegExp route against the full request href, not the pathname.
 * The worker script and the Workbox runtime stay out of this cache so updates are seen.
 */
export function runtimePattern(basePath: string): RegExp {
  const root = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^[a-z]+:\\/\\/[^/]+${root}(?!sw\\.js$)(?!workbox-[^/]+\\.js$)(?:data/.+|.+\\.(?:wasm|mjs|js))$`);
}

export interface WebManifestIcon {
  src: string;
  sizes: string;
  type: 'image/png';
  purpose: 'any' | 'maskable';
}

export interface WebManifest {
  name: string;
  short_name: string;
  description: string;
  lang: 'en';
  start_url: string;
  scope: string;
  display: 'standalone';
  background_color: string;
  theme_color: string;
  icons: WebManifestIcon[];
}

export function webManifest(basePath: string): WebManifest {
  const icon = (name: string) => siteUrl(basePath, `icons/${name}`);
  return {
    name: 'xt-tools',
    short_name: 'xt-tools',
    description: 'Privacy-first tools that run in your browser.',
    lang: 'en',
    start_url: basePath,
    scope: basePath,
    display: 'standalone',
    background_color: '#1d4ed8',
    theme_color: '#1d4ed8',
    icons: [
      { src: icon('icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon('icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon('icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

function toFile(url: string, dist: string, basePath: string): string | undefined {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:')) return undefined;
  const path = url.split(/[?#]/)[0] ?? '';
  const rel = path.startsWith(basePath) ? path.slice(basePath.length) : path.replace(/^\//, '');
  const file = join(dist, rel);
  return existsSync(file) ? file : undefined;
}

/** Same static module graph as check-budget: scripts, preloads and island URLs, then static imports. */
export function staticScriptFiles(dist: string, basePath: string): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const htmlFile of walk(dist).filter((file) => file.endsWith('.html'))) {
    const html = readFileSync(htmlFile, 'utf8');
    const urls = [
      ...[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]),
      ...[...html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map((match) => match[1]),
      ...[...html.matchAll(/\s(?:component|renderer|before-hydration)-url="([^"]+)"/g)].map((match) => match[1]),
    ].filter((url): url is string => !!url);
    for (const url of urls) {
      const file = toFile(url, dist, basePath);
      if (file && /\.m?js$/.test(file)) queue.push(file);
    }
  }
  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let code: string;
    try {
      code = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const spec of staticImports(code)) {
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
      const next = spec.startsWith('/') ? toFile(spec, dist, basePath) : join(dirname(file), spec);
      if (next && existsSync(next) && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

function isGeneratedWorker(rel: string): boolean {
  return rel === 'sw.js' || /^workbox-[^/]+\.js$/.test(rel);
}

function isHeavy(rel: string, file: string, scripts: Set<string>): boolean {
  if (rel.startsWith('data/')) return true;
  if (rel.endsWith('.wasm')) return true;
  if (rel.startsWith('_astro/') && rel.endsWith('.json')) return true;
  if (/\.m?js$/.test(rel) && !scripts.has(file)) return true;
  return false;
}

export interface ClassifiedAssets {
  /** Site-relative paths to precache (no base prefix). */
  precache: string[];
  /** Site-relative paths fetched by "Download everything". */
  heavy: string[];
}

export function classifyDist(dist: string, basePath: string): ClassifiedAssets {
  const scripts = staticScriptFiles(dist, basePath);
  const precache: string[] = [];
  const heavy: string[] = [];
  for (const file of walk(dist)) {
    const rel = relative(dist, file).split('\\').join('/');
    if (rel.endsWith('.gz') || rel.endsWith('.br') || rel.endsWith('.map')) continue;
    if (isGeneratedWorker(rel)) continue;
    if (isHeavy(rel, file, scripts)) heavy.push(rel);
    else if (scripts.has(file) || PRECACHE_EXT.test(rel) || rel === 'search-index.json') precache.push(rel);
  }
  precache.sort();
  heavy.sort();
  return { precache, heavy };
}

export function contentRevision(file: string): string {
  return createHash('md5').update(readFileSync(file)).digest('hex');
}

export interface HeavyManifest {
  assets: string[];
}

export function heavyManifest(basePath: string, heavy: readonly string[]): HeavyManifest {
  return { assets: heavy.map((rel) => siteUrl(basePath, rel)) };
}
