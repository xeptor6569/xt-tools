// Fuse.js over the build-time catalog. The library loads the first time
// someone searches. Title weighs more than tags, keywords and the description.
// Every query word has to match. A weak hit is dropped: Fuse 7 still returns
// some results past its own threshold.

import type Fuse from 'fuse.js';

export interface SearchDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  groupLabel?: string;
  keywords: string[];
  tags: string[];
}

export interface SearchHit {
  id: string;
  /** Higher is a closer match. */
  score: number;
}

export interface SearchResults {
  hits: SearchHit[];
  total: number;
}

const RESULT_LIMIT = 8;
const SCORE_CUTOFF = 0.7;

export { highlight } from './search-highlight.ts';

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

function withinEdits(left: string, right: string, max: number): boolean {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > max) return false;
  const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
  const next = Array.from({ length: right.length + 1 }, () => 0);
  for (let i = 1; i <= left.length; i++) {
    next[0] = i;
    let rowMin = i;
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      const value = Math.min((prev[j] ?? max) + 1, (next[j - 1] ?? max) + 1, (prev[j - 1] ?? max) + cost);
      next[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return false;
    for (let j = 0; j < prev.length; j++) prev[j] = next[j] ?? max;
  }
  return (prev[right.length] ?? max + 1) <= max;
}

function haystack(doc: SearchDocument): string[] {
  return words(
    [doc.name, doc.description, doc.categoryLabel, doc.groupLabel ?? '', ...doc.tags, ...doc.keywords].join(' '),
  );
}

/** Every query word is present, or a longer word is one or two edits away. */
function covers(doc: SearchDocument, tokens: readonly string[]): boolean {
  const fields = haystack(doc);
  const blob = fields.join(' ');
  return tokens.every((token) => {
    if (blob.includes(token)) return true;
    if (token.length < 5) return false;
    const max = token.length >= 8 ? 2 : 1;
    return fields.some((field) => field.length >= 4 && withinEdits(token, field, max));
  });
}

let cached: { docs: readonly SearchDocument[]; fuse: Fuse<SearchDocument> } | undefined;

async function indexFor(docs: readonly SearchDocument[]): Promise<Fuse<SearchDocument>> {
  if (cached && cached.docs === docs) return cached.fuse;
  const { default: Fuse } = await import('fuse.js');
  const fuse = new Fuse(docs, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'tags', weight: 0.2 },
      { name: 'keywords', weight: 0.15 },
      { name: 'description', weight: 0.1 },
      { name: 'categoryLabel', weight: 0.03 },
      { name: 'groupLabel', weight: 0.02 },
    ],
    ignoreLocation: true,
    includeScore: true,
    threshold: SCORE_CUTOFF,
    minMatchCharLength: 2,
    useTokenSearch: true,
    tokenMatch: 'all',
  });
  cached = { docs, fuse };
  return fuse;
}

/** Best matches first. An empty query matches nothing. */
export async function searchTools(
  docs: readonly SearchDocument[],
  query: string,
  limit = RESULT_LIMIT,
): Promise<SearchResults> {
  const text = query.trim();
  const tokens = words(text);
  if (tokens.length === 0) return { hits: [], total: 0 };
  const fuse = await indexFor(docs);
  const matched = fuse
    .search(text)
    .filter((result) => (result.score ?? 1) <= SCORE_CUTOFF && covers(result.item, tokens));
  return {
    total: matched.length,
    hits: matched.slice(0, limit).map((result) => ({
      id: result.item.id,
      score: 1 - (result.score ?? 1),
    })),
  };
}
