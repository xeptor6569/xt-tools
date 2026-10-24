// Builds the service worker, web manifest and heavy-asset list after `astro build`.
// Scope is the base path. workbox-build has no scope field; registration sets it.
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateSW } from 'workbox-build';
import { ROOT } from './lib/tools.ts';
import {
  classifyDist,
  contentRevision,
  heavyManifest,
  readBasePath,
  runtimePattern,
  siteUrl,
  webManifest,
} from './pwa.ts';

const DIST = join(ROOT, 'dist');

function removeStaleWorkers(): void {
  for (const name of readdirSync(DIST)) {
    if (name === 'sw.js' || /^workbox-[^/]+\.js$/.test(name)) rmSync(join(DIST, name));
  }
}

export async function buildServiceWorker(): Promise<void> {
  const basePath = readBasePath();
  removeStaleWorkers();
  const { precache, heavy } = classifyDist(DIST, basePath);

  const heavyPath = join(DIST, 'heavy-assets.json');
  writeFileSync(heavyPath, `${JSON.stringify(heavyManifest(basePath, heavy), null, 2)}\n`);
  const manifestPath = join(DIST, 'manifest.webmanifest');
  writeFileSync(manifestPath, `${JSON.stringify(webManifest(basePath), null, 2)}\n`);

  const files = [...precache, 'heavy-assets.json', 'manifest.webmanifest'];
  const { count, warnings } = await generateSW({
    swDest: join(DIST, 'sw.js'),
    globDirectory: DIST,
    globPatterns: [],
    inlineWorkboxRuntime: false,
    sourcemap: false,
    mode: 'production',
    skipWaiting: false,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    directoryIndex: 'index.html',
    disableDevLogs: true,
    cacheId: 'xt',
    additionalManifestEntries: files.map((rel) => ({
      url: siteUrl(basePath, rel),
      revision: contentRevision(join(DIST, rel)),
    })),
    runtimeCaching: [
      {
        urlPattern: runtimePattern(basePath),
        handler: 'CacheFirst',
        options: {
          // Keep in sync with RUNTIME_CACHE in src/lib/settings.ts.
          cacheName: 'xt-runtime',
          // A module import sends Origin. Download everything stores the file
          // from a fetch that does not. Servers that send Vary: Origin (astro
          // preview does) would then hide the saved file from the import.
          matchOptions: { ignoreVary: true },
          cacheableResponse: { statuses: [200] },
          expiration: { maxEntries: 500 },
        },
      },
    ],
  });

  if (warnings.length > 0) {
    console.error('gen-sw: warnings:');
    for (const warning of warnings) console.error(`  - ${warning}`);
    throw new Error('gen-sw: workbox reported warnings');
  }
  console.log(
    `gen-sw: precached ${count} file(s), ${heavy.length} heavy asset(s), scope ${basePath}, swDest dist/sw.js.`,
  );
}

if (import.meta.main) {
  try {
    await buildServiceWorker();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
