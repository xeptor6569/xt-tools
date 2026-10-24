// Settings actions: download lazy assets, persist storage, clear local data.
import { formatEstimate } from './format-bytes.ts';
import { loadLocalAsset, resolveLocalAsset } from './load-local-asset.ts';
import { clearAll } from './storage.ts';

// Must match the runtime cacheName in scripts/gen-sw.ts. Writing here, not only
// through a fetch the service worker happens to see, so the files are cached
// even when something else handles the request.
const RUNTIME_CACHE = 'xt-runtime';

interface HeavyManifest {
  assets?: unknown;
}

async function ignore(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch {
    // Cache Storage and service workers are missing outside a secure context,
    // and the regular end-to-end suite blocks registration.
  }
}

export async function clearSiteData(): Promise<void> {
  clearAll();
  await ignore(async () => {
    if (!('caches' in globalThis)) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  });
  await ignore(async () => {
    const idb = globalThis.indexedDB;
    if (!idb || !('databases' in idb)) return;
    const databases = await idb.databases();
    await Promise.all(
      databases.map(
        (database) =>
          new Promise<void>((resolve) => {
            const name = database.name;
            if (!name) {
              resolve();
              return;
            }
            const request = idb.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
    );
  });
  await ignore(async () => {
    if (!('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });
}

async function whenControlled(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  if (navigator.serviceWorker.controller) return;
  await navigator.serviceWorker.ready.catch(() => undefined);
  if (navigator.serviceWorker.controller) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 15_000);
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function persistNote(): Promise<string> {
  try {
    const storage = navigator.storage;
    if (!storage?.persist) return '';
    const kept = await storage.persist();
    return kept
      ? ' This browser will try to keep the saved files.'
      : ' This browser may still remove the saved files later.';
  } catch {
    return '';
  }
}

async function refreshEstimate(): Promise<void> {
  const output = document.querySelector<HTMLElement>('[data-xt="storage-estimate"]');
  if (!output || !navigator.storage?.estimate) return;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    output.textContent = formatEstimate(usage, quota);
  } catch {
    output.textContent = '';
  }
}

async function eachAsset(assets: readonly string[], onOne: (url: string) => Promise<void>): Promise<void> {
  let cursor = 0;
  const run = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= assets.length) return;
      const url = assets[index];
      if (url === undefined) return;
      await onOne(url);
    }
  };
  const workers = Math.min(6, assets.length);
  await Promise.all(Array.from({ length: workers }, () => run()));
}

function assetList(body: unknown): string[] {
  const assets = (body as HeavyManifest).assets;
  if (!Array.isArray(assets) || assets.some((item) => typeof item !== 'string')) {
    throw new Error('The offline file list is not valid.');
  }
  return assets;
}

export function startSettings(): void {
  const actions = document.querySelector<HTMLElement>('[data-xt="offline-actions"]');
  const secure = globalThis.isSecureContext && 'caches' in globalThis && 'serviceWorker' in navigator;
  if (!secure) {
    const note = document.querySelector<HTMLElement>('[data-xt="offline-needs-https"]');
    if (note) note.hidden = false;
  } else if (actions) {
    actions.hidden = false;
    void refreshEstimate();
    const button = document.querySelector<HTMLButtonElement>('[data-xt="download"]');
    const status = document.querySelector<HTMLElement>('[data-xt="download-status"]');
    button?.addEventListener('click', () => {
      if (!button || button.disabled) return;
      button.disabled = true;
      if (status) status.textContent = 'Saving files for offline use…';
      void (async () => {
        try {
          await whenControlled();
          const response = await loadLocalAsset('heavy-assets.json');
          const assets = assetList(await response.json());
          const cache = await caches.open(RUNTIME_CACHE);
          let finished = 0;
          let failed = 0;
          await eachAsset(assets, async (url) => {
            try {
              await cache.add(resolveLocalAsset(url));
            } catch {
              failed += 1;
            } finally {
              finished += 1;
              if (status) status.textContent = `Saved ${finished - failed} of ${assets.length} files.`;
            }
          });
          const saved = assets.length - failed;
          const summary =
            assets.length === 0
              ? 'No extra files to download. The pages are already saved for offline use.'
              : failed === 0
                ? `Saved ${saved} files for offline use.`
                : `Saved ${saved} of ${assets.length} files. ${failed} could not be saved.`;
          if (status) status.textContent = summary + (await persistNote());
          await refreshEstimate();
        } catch (error) {
          if (status)
            status.textContent = error instanceof Error ? error.message : 'Could not save files for offline use.';
        } finally {
          button.disabled = false;
        }
      })();
    });
  }

  const clear = document.querySelector<HTMLButtonElement>('[data-xt="clear"]');
  const confirm = document.querySelector<HTMLElement>('[data-xt="clear-confirm"]');
  const go = document.querySelector<HTMLButtonElement>('[data-xt="clear-go"]');
  const error = document.querySelector<HTMLElement>('[data-xt="settings-error"]');
  clear?.addEventListener('click', () => {
    if (confirm) confirm.hidden = false;
  });
  go?.addEventListener('click', () => {
    if (!go || go.disabled) return;
    go.disabled = true;
    void clearSiteData()
      .then(() => location.reload())
      .catch(() => {
        go.disabled = false;
        if (error) error.textContent = 'Could not clear local data.';
      });
  });
}
