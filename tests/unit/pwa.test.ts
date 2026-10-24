import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pngSize } from '../../scripts/gen-icons.ts';
import { readFileSync } from 'node:fs';
import { classifyDist, heavyManifest, readBasePath, runtimePattern, webManifest } from '../../scripts/pwa.ts';
import { ROOT } from '../../scripts/lib/tools.ts';

describe('PWA manifest and runtime cache', () => {
  it('uses the base path as start_url and scope', () => {
    expect(readBasePath('/tools/')).toBe('/tools/');
    expect(() => readBasePath('tools')).toThrow(/BASE_PATH/);
    const manifest = webManifest('/tools/');
    expect(manifest.start_url).toBe('/tools/');
    expect(manifest.scope).toBe('/tools/');
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      '/tools/icons/icon-192.png',
      '/tools/icons/icon-512.png',
      '/tools/icons/icon-maskable-512.png',
    ]);
    expect(manifest.icons.every((icon) => icon.src.startsWith('/tools/'))).toBe(true);
  });

  it('runtime-caches data, wasm and lazy scripts, and not the worker', () => {
    const root = runtimePattern('/');
    expect(root.test('http://localhost:4321/data/gitignore-0e5d690.json')).toBe(true);
    expect(root.test('https://tools.example/data/gitignore-0e5d690.json')).toBe(true);
    expect(root.test('http://localhost:4321/_astro/chunk.js')).toBe(true);
    expect(root.test('http://localhost:4321/_astro/codec.wasm')).toBe(true);
    expect(root.test('http://localhost:4321/sw.js')).toBe(false);
    expect(root.test('http://localhost:4321/workbox-abc123.js')).toBe(false);
    expect(root.test('http://localhost:4321/index.html')).toBe(false);
    expect(root.test('http://localhost:4321/search-index.json')).toBe(false);
    expect(root.test('/_astro/chunk.js')).toBe(false);

    const nested = runtimePattern('/tools/');
    expect(nested.test('http://localhost:4321/tools/_astro/chunk.js')).toBe(true);
    expect(nested.test('http://localhost:4321/tools/sw.js')).toBe(false);
    expect(nested.test('http://localhost:4321/_astro/chunk.js')).toBe(false);
  });
});

describe('classifyDist', () => {
  it('precaches the static graph and lists lazy files for download', () => {
    const dist = mkdtempSync(join(tmpdir(), 'xt-pwa-'));
    mkdirSync(join(dist, '_astro'));
    mkdirSync(join(dist, 'data'));
    writeFileSync(
      join(dist, 'index.html'),
      '<script type="module" src="/app.js"></script><link rel="stylesheet" href="/app.css">',
    );
    writeFileSync(join(dist, 'app.js'), 'import "./lib.js";\n');
    writeFileSync(join(dist, 'lib.js'), 'export const ready = true;\n');
    writeFileSync(join(dist, 'app.css'), 'body{color:black}\n');
    writeFileSync(join(dist, '_astro', 'lazy.js'), 'export const lazy = true;\n');
    writeFileSync(join(dist, '_astro', 'codec.wasm'), 'wasm');
    writeFileSync(join(dist, 'data', 'set.json'), '{}\n');
    writeFileSync(join(dist, 'search-index.json'), '[]\n');
    writeFileSync(join(dist, 'sw.js'), 'self.addEventListener("install",()=>{});\n');

    const { precache, heavy } = classifyDist(dist, '/');
    expect(precache).toEqual(['app.css', 'app.js', 'index.html', 'lib.js', 'search-index.json']);
    expect(heavy).toEqual(['_astro/codec.wasm', '_astro/lazy.js', 'data/set.json']);
    expect(heavyManifest('/', heavy).assets).toEqual(['/_astro/codec.wasm', '/_astro/lazy.js', '/data/set.json']);
  });
});

describe('PWA icons', () => {
  it('ships local PNGs at the manifest sizes', () => {
    const files = [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const;
    for (const [name, size] of files) {
      const png = readFileSync(join(ROOT, 'public', 'icons', name));
      expect(pngSize(png)).toEqual({ width: size, height: size });
    }
  });
});
