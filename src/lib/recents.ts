// Recently opened tools. Pure data only: storage lives in recents-store.ts.

export const RECENTS_KEY = 'recent';
export const MAX_RECENTS = 12;

const TOOL_ID = /^[a-z0-9-]{2,40}$/;

export function sanitizeRecents(value: unknown, known?: ReadonlySet<string>): string[] {
  const raw = value && typeof value === 'object' && 'ids' in value ? (value as { ids: unknown }).ids : value;
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string' || !TOOL_ID.test(item) || seen.has(item)) continue;
    if (known && !known.has(item)) continue;
    seen.add(item);
    ids.push(item);
    if (ids.length >= MAX_RECENTS) break;
  }
  return ids;
}

/** Newest first, duplicates moved to the front, capped at {@link MAX_RECENTS}. */
export function rememberRecent(ids: readonly string[], id: string): string[] {
  if (!TOOL_ID.test(id)) return [...ids];
  return [id, ...ids.filter((item) => item !== id)].slice(0, MAX_RECENTS);
}
