// Ranks the catalog for the header search. Title, tags, keywords and the
// description (the page's content sentence) each have their own weight.
// A longer word can miss by one or two edits. Short words cannot, so "ip"
// does not fuzzy-match the rest of the catalog.

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
  score: number;
}

export interface SearchResults {
  hits: SearchHit[];
  total: number;
}

const RESULT_LIMIT = 8;

const NAME_EXACT = 120;
const NAME_PREFIX = 80;
const NAME_WORD = 60;
const NAME_CONTAINS = 40;
const TAG_EXACT = 70;
const TAG_PREFIX = 36;
const KEYWORD_EXACT = 50;
const KEYWORD_WORD = 28;
const DESCRIPTION_WORD = 18;
const CATEGORY_WORD = 14;
const FUZZY = 8;
const PHRASE_IN_NAME = 40;
const PHRASE_IN_DESCRIPTION = 24;

function normalize(value: string): string {
  return value.toLowerCase();
}

function words(value: string): string[] {
  return normalize(value)
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

function tokenScore(token: string, doc: SearchDocument): number {
  const name = normalize(doc.name);
  const nameWords = words(doc.name);
  if (token.length < 2)
    return name.startsWith(token) || nameWords.some((word) => word.startsWith(token)) ? NAME_PREFIX : 0;

  let best = 0;
  if (name === token) best = NAME_EXACT;
  else if (name.startsWith(token)) best = NAME_PREFIX;
  else if (nameWords.includes(token)) best = NAME_WORD;
  else if (name.includes(token)) best = NAME_CONTAINS;

  for (const tag of doc.tags) {
    const label = normalize(tag);
    if (label === token) best = Math.max(best, TAG_EXACT);
    else if (token.length >= 2 && label.startsWith(token)) best = Math.max(best, TAG_PREFIX);
  }

  for (const keyword of doc.keywords) {
    const label = normalize(keyword);
    if (label === token) best = Math.max(best, KEYWORD_EXACT);
    else if (words(keyword).includes(token) || (token.length >= 3 && label.includes(token))) {
      best = Math.max(best, KEYWORD_WORD);
    }
  }

  const description = normalize(doc.description);
  if (words(doc.description).includes(token) || (token.length >= 3 && description.includes(token))) {
    best = Math.max(best, DESCRIPTION_WORD);
  }

  const category = `${doc.categoryLabel} ${doc.groupLabel ?? ''}`;
  if (words(category).includes(token)) best = Math.max(best, CATEGORY_WORD);

  if (best === 0 && token.length >= 5) {
    const max = token.length >= 8 ? 2 : 1;
    const candidates = [...nameWords, ...doc.tags.map(normalize), ...doc.keywords.flatMap(words)];
    if (candidates.some((candidate) => candidate.length >= 4 && withinEdits(token, candidate, max))) best = FUZZY;
  }
  return best;
}

/** Best matches first. Every query word has to match somewhere. */
export function searchTools(docs: readonly SearchDocument[], query: string, limit = RESULT_LIMIT): SearchResults {
  const phrase = normalize(query).trim();
  const parts = words(query);
  if (parts.length === 0) return { hits: [], total: 0 };

  const ranked: SearchHit[] = [];
  for (const doc of docs) {
    let score = 0;
    let matched = true;
    for (const part of parts) {
      const partScore = tokenScore(part, doc);
      if (partScore === 0) {
        matched = false;
        break;
      }
      score += partScore;
    }
    if (!matched) continue;
    const name = normalize(doc.name);
    if (name === phrase) score += NAME_EXACT;
    else if (phrase.length > 1 && name.startsWith(phrase)) score += PHRASE_IN_NAME;
    if (parts.length > 1 && normalize(doc.description).includes(phrase)) score += PHRASE_IN_DESCRIPTION;
    ranked.push({ id: doc.id, score });
  }

  ranked.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return { hits: ranked.slice(0, limit), total: ranked.length };
}

/** Splits text into matched and unmatched pieces for a <mark>, without HTML. */
export function highlight(text: string, query: string): Array<{ text: string; match: boolean }> {
  const needles = [...new Set(words(query))].filter((word) => word.length >= 2).sort((a, b) => b.length - a.length);
  if (needles.length === 0 || text.length === 0) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const needle of needles) {
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      ranges.push([at, at + needle.length]);
      from = at + needle.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (!last || range[0] > last[1]) merged.push([range[0], range[1]]);
    else if (range[1] > last[1]) last[1] = range[1];
  }
  if (merged.length === 0) return [{ text, match: false }];
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}
