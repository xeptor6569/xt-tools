import type { Emoji } from './data.ts';

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();

/** Matches every word of the query against the name, tags and shortcodes. */
export function searchEmoji(emoji: readonly Emoji[], query: string, group?: number): Emoji[] {
  const terms = fold(query.slice(0, 200)).replace(/:/g, ' ').split(/\s+/).filter(Boolean);
  return emoji.filter((e) => {
    if (group !== undefined && e.group !== group) return false;
    if (terms.length === 0) return true;
    // An emoji typed into the search box finds itself.
    if (terms.length === 1 && e.emoji === query.trim()) return true;
    const haystack = fold(`${e.label} ${e.tags.join(' ')} ${e.shortcodes.join(' ')}`);
    return terms.every((t) => haystack.includes(t));
  });
}

export function codePoints(emoji: string): string {
  return [...emoji].map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
}

/** Applies a skin tone (1–5) when the emoji supports it. */
export function withSkin(e: Emoji, tone: number): string {
  return tone > 0 && e.skins[tone - 1] ? e.skins[tone - 1]! : e.emoji;
}
