// Fuse.js over the build-time search index. Loaded only when search opens.

import Fuse from 'fuse.js';
import { loadLocalAsset } from './load-local-asset.ts';

export interface SearchEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  keywords: string[];
  added: string;
}

export interface Searcher {
  entries: readonly SearchEntry[];
  search: (query: string) => SearchEntry[];
}

const RESULT_LIMIT = 8;

function isEntry(value: unknown): value is SearchEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<SearchEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.description === 'string' &&
    typeof entry.category === 'string' &&
    typeof entry.categoryLabel === 'string' &&
    Array.isArray(entry.keywords) &&
    entry.keywords.every((keyword) => typeof keyword === 'string') &&
    typeof entry.added === 'string'
  );
}

/** Fuzzy match for two or more characters. A single character uses a plain contains check. */
export function createSearcher(
  entries: readonly SearchEntry[],
  limit = RESULT_LIMIT,
): (query: string) => SearchEntry[] {
  const fuse = new Fuse(entries, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'keywords', weight: 0.3 },
      { name: 'description', weight: 0.15 },
      { name: 'id', weight: 0.05 },
    ],
    ignoreLocation: true,
    includeScore: true,
    threshold: 0.4,
    minMatchCharLength: 2,
  });
  return (query: string) => {
    const text = query.trim();
    if (text.length === 0) return [];
    if (text.length === 1) {
      const needle = text.toLowerCase();
      return entries
        .filter(
          (entry) =>
            entry.name.toLowerCase().includes(needle) ||
            entry.id.includes(needle) ||
            entry.keywords.some((keyword) => keyword.includes(needle)),
        )
        .slice(0, limit);
    }
    // Fuse 7 still returns weak hits above `threshold`, so drop them here.
    return fuse
      .search(text)
      .filter((result) => (result.score ?? 1) <= 0.4)
      .slice(0, limit)
      .map((result) => result.item);
  };
}

let pending: Promise<Searcher> | undefined;

/** Fetches `search-index.json` once and builds the Fuse index. */
export function loadSearcher(): Promise<Searcher> {
  pending ??= loadLocalAsset('search-index.json')
    .then((response) => response.json() as Promise<unknown>)
    .then((body) => {
      const entries = Array.isArray(body) ? body.filter(isEntry) : [];
      return { entries, search: createSearcher(entries) };
    });
  return pending;
}
