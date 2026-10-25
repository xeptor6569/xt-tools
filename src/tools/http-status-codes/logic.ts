import type { Row } from './data.ts';

/** Case- and accent-insensitive search across every column. */
export function httpStatusCodes(rows: readonly Row[], query: string): Row[] {
  const fold = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase();
  const terms = fold(query.slice(0, 200)).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...rows];
  return rows.filter((row) => {
    const haystack = fold(Object.values(row).join(' '));
    return terms.every((t) => haystack.includes(t));
  });
}
