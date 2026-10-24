import type { Row } from './data.ts';

/** Value of the section filter that shows every section. */
export const ALL_SECTIONS = 'all';

/** Longer queries are cut to this many characters. */
export const MAX_QUERY = 200;

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();

/**
 * Lower is better: the exact syntax (case-sensitive, so \D ranks above \d),
 * then syntax starting a word with the query, containing it verbatim,
 * containing it ignoring case, then a description starting with the query,
 * and finally any other match.
 */
function rank(row: Row, query: string): number {
  const { syntax } = row;
  if (syntax === query) return 0;
  if (` ${syntax}`.includes(` ${query}`)) return 1;
  if (syntax.includes(query)) return 2;
  if (fold(syntax).includes(fold(query))) return 3;
  return fold(row.description).startsWith(fold(query)) ? 4 : 5;
}

/**
 * Case- and accent-insensitive search across every column, optionally limited
 * to one section. Every whitespace-separated term must match. Rows whose
 * syntax contains the query itself are listed first, otherwise the data order
 * is kept.
 */
export function regexCheatsheet(rows: readonly Row[], query: string, section: string = ALL_SECTIONS): Row[] {
  const scoped = section === ALL_SECTIONS ? rows : rows.filter((row) => row.section === section);
  const trimmed = query.slice(0, MAX_QUERY).trim();
  const terms = fold(trimmed).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...scoped];
  return scoped
    .filter((row) => {
      const haystack = fold(Object.values(row).join(' '));
      return terms.every((t) => haystack.includes(t));
    })
    .map((row, index) => ({ row, index, rank: rank(row, trimmed) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.row);
}
