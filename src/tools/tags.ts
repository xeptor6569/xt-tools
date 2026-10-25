// Default public tags for a scaffolded tool. Curated tools set `meta.tags` themselves.
import { MAX_TAGS, TAG_PATTERN } from './validate-meta.ts';

function tagWords(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && word.length <= 24 && TAG_PATTERN.test(word));
}

/** Up to four labels drawn from keywords, then the name. */
export function deriveTags(name: string, keywords: readonly string[]): string[] {
  const tags: string[] = [];
  for (const word of [...keywords.flatMap(tagWords), ...tagWords(name)]) {
    if (!tags.includes(word)) tags.push(word);
    if (tags.length === MAX_TAGS) break;
  }
  return tags.length > 0 ? tags : ['tool'];
}
