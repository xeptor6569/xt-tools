// Namespaced localStorage. Keys are prefixed with the base path so two
// instances on one domain don't collide. All access goes through here.

const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export const STORAGE_PREFIX = `xt:${BASE}:`;

export function storageKey(key: string): string {
  return STORAGE_PREFIX + key;
}

function store(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // Blocked (e.g. some private-browsing modes).
  }
}

export function readJson<T>(key: string): T | undefined {
  const raw = store()?.getItem(storageKey(key));
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked: persistence is best-effort.
  }
}

export function removeKey(key: string): void {
  try {
    store()?.removeItem(storageKey(key));
  } catch {
    // Ignore.
  }
}

/** Removes every key this instance has written. */
export function clearAll(): void {
  const s = store();
  if (!s) return;
  for (const key of Object.keys(s)) if (key.startsWith(STORAGE_PREFIX)) s.removeItem(key);
}
