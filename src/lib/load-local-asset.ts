// The only sanctioned way to fetch at runtime: same-origin files that ship
// with the site (datasets in public/data, WASM imported with ?url). Anything
// else is rejected before a request is made.
import { href } from './href.ts';

export class ExternalAssetError extends Error {
  constructor(url: string) {
    super(`Refusing to load ${url}: only files bundled with this site can be loaded.`);
    this.name = 'ExternalAssetError';
  }
}

/** Resolves a site-relative path (e.g. "data/oui-2026-10.json") or a URL from `import x from '...?url'`. */
export function resolveLocalAsset(pathOrUrl: string, origin = globalThis.location?.origin): URL {
  const isRootRelative = pathOrUrl.startsWith('/') && !pathOrUrl.startsWith('//');
  const url = new URL(isRootRelative ? pathOrUrl : href(pathOrUrl), origin);
  if (url.origin !== origin) throw new ExternalAssetError(pathOrUrl);
  return url;
}

export async function loadLocalAsset(pathOrUrl: string, init?: Pick<RequestInit, 'signal'>): Promise<Response> {
  const url = resolveLocalAsset(pathOrUrl);
  const response = await fetch(url, {
    ...init,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    mode: 'same-origin',
  });
  if (!response.ok) throw new Error(`Could not load ${url.pathname} (HTTP ${response.status}).`);
  return response;
}
