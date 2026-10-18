// Small RFC 4180 CSV reader and writer, shared by the converter tools.
// Handles quoted fields, escaped quotes, embedded newlines and CRLF.

export type Delimiter = ',' | ';' | '\t' | '|';

/** Picks the delimiter that splits the first line most consistently. */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.split(/\r?\n/).slice(0, 10);
  const candidates: Delimiter[] = [',', '\t', ';', '|'];
  let best: Delimiter = ',';
  let bestScore = 0;
  for (const d of candidates) {
    const counts = sample.map((line) => line.split(d).length - 1);
    const first = counts[0] ?? 0;
    const consistent = counts.filter((c) => c === first).length;
    const score = first > 0 ? first * consistent : 0;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export class CsvError extends Error {}

export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const s = text.replace(/^\uFEFF/, '');
  while (i < s.length) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      i++;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += ch === '\r' && s[i + 1] === '\n' ? 2 : 1;
    } else {
      field += ch;
      i++;
    }
  }
  if (quoted) throw new CsvError('A quoted field is never closed.');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function quote(value: string, delimiter: string): string {
  return /["\r\n]/.test(value) || value.includes(delimiter) || /^\s|\s$/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

export function writeCsv(rows: readonly (readonly string[])[], delimiter: Delimiter = ','): string {
  return rows.map((r) => r.map((v) => quote(v, delimiter)).join(delimiter)).join('\n');
}

/** First row as headers, the rest as objects. */
export function csvToObjects(text: string, delimiter?: Delimiter): Array<Record<string, string>> {
  const rows = parseCsv(text, delimiter);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h, i) => h.trim() || `column${i + 1}`);
  return body
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Objects to rows: the header is the union of keys, in first-seen order. */
export function objectsToRows(items: readonly unknown[]): string[][] {
  const keys: string[] = [];
  for (const item of items) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      for (const k of Object.keys(item)) if (!keys.includes(k)) keys.push(k);
    }
  }
  if (keys.length === 0) return items.map((v) => [cellText(v)]);
  return [keys, ...items.map((item) => keys.map((k) => cellText((item as Record<string, unknown>)?.[k])))];
}
