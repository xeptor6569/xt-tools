// Splits text into matched and unmatched pieces for a <mark>, without HTML.

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

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
