import { CsvError, objectsToRows, parseCsv, writeCsv } from '../../lib/csv.ts';
import { ToolInputError } from '../types.ts';

export type TableFormat = 'csv' | 'tsv' | 'json' | 'markdown' | 'html';
export type Align = 'none' | 'left' | 'center' | 'right';

export const TABLE_FORMATS: ReadonlyArray<{ value: TableFormat; label: string }> = [
  { value: 'csv', label: 'CSV' },
  { value: 'tsv', label: 'TSV' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
];

/** Rows of cells; the first row is the header. */
export type Table = string[][];

const MAX_INPUT = 5_000_000;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(
          parseInt(e.slice(e[1]?.toLowerCase() === 'x' ? 2 : 1), e[1]?.toLowerCase() === 'x' ? 16 : 10),
        )
      : (ENTITIES[e.toLowerCase()] ?? m),
  );
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function detectFormat(text: string): TableFormat {
  const t = text.trim();
  if (/^[[{]/.test(t)) return 'json';
  if (/^<|<table/i.test(t)) return 'html';
  if (/^\|?.*\|.*\n\|?\s*:?-{3,}/.test(t)) return 'markdown';
  if (t.split('\n')[0]?.includes('\t')) return 'tsv';
  return 'csv';
}

function parseMarkdown(text: string): Table {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, '|'));
  const rows = lines.filter((l, i) => !(i === 1 && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l))).map(cells);
  if (rows.length === 0) throw new ToolInputError('No Markdown table found.');
  return rows;
}

function parseHtml(text: string): Table {
  const table = /<table[\s\S]*?<\/table>/i.exec(text)?.[0] ?? text;
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((tr) =>
    [...(tr[1] ?? '').matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((td) =>
      decodeEntities((td[1] ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim(),
    ),
  );
  if (rows.length === 0) throw new ToolInputError('No HTML table rows (<tr>) found.');
  return rows;
}

function parseJson(text: string): Table {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new ToolInputError(`Invalid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(data)) throw new ToolInputError('JSON tables must be an array of objects or an array of arrays.');
  if (data.every(Array.isArray))
    return (data as unknown[][]).map((r) =>
      r.map((c) => (typeof c === 'object' && c !== null ? JSON.stringify(c) : String(c ?? ''))),
    );
  return objectsToRows(data);
}

export function parseTable(text: string, format: TableFormat): Table {
  try {
    switch (format) {
      case 'csv':
        return parseCsv(text);
      case 'tsv':
        return parseCsv(text, '\t');
      case 'json':
        return parseJson(text);
      case 'markdown':
        return parseMarkdown(text);
      case 'html':
        return parseHtml(text);
    }
  } catch (e) {
    if (e instanceof CsvError) throw new ToolInputError(`Invalid ${format.toUpperCase()}: ${e.message}`);
    throw e;
  }
}

function normalize(table: Table): Table {
  const width = Math.max(...table.map((r) => r.length));
  return table.map((r) => [...r, ...Array<string>(width - r.length).fill('')]);
}

export function writeTable(table: Table, format: TableFormat, { align = 'none' as Align, pad = true } = {}): string {
  const t = normalize(table);
  const [header = [], ...body] = t;
  switch (format) {
    case 'csv':
      return writeCsv(t);
    case 'tsv':
      return t.map((r) => r.map((c) => c.replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
    case 'json':
      return JSON.stringify(
        body.map((r) => Object.fromEntries(header.map((h, i) => [h || `column${i + 1}`, r[i] ?? '']))),
        null,
        2,
      );
    case 'markdown': {
      const esc = (c: string) => c.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const rows = t.map((r) => r.map(esc));
      const widths = header.map((_, i) => Math.max(3, ...rows.map((r) => [...(r[i] ?? '')].length)));
      const fit = (c: string, i: number) => (pad ? c + ' '.repeat(widths[i]! - [...c].length) : c);
      const rule = widths.map((w) => {
        const dashes = '-'.repeat(pad ? w : 3);
        if (align === 'left') return `:${dashes.slice(1)}`;
        if (align === 'right') return `${dashes.slice(1)}:`;
        if (align === 'center') return `:${dashes.slice(2)}:`;
        return dashes;
      });
      const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
      return [line(rows[0]!.map(fit)), line(rule), ...rows.slice(1).map((r) => line(r.map(fit)))].join('\n');
    }
    case 'html': {
      const style = align === 'none' ? '' : ` style="text-align: ${align}"`;
      const cell = (tag: string, c: string) => `<${tag}${style}>${escapeHtml(c).replace(/\n/g, '<br>')}</${tag}>`;
      return [
        '<table>',
        '  <thead>',
        `    <tr>${header.map((c) => cell('th', c)).join('')}</tr>`,
        '  </thead>',
        '  <tbody>',
        ...body.map((r) => `    <tr>${r.map((c) => cell('td', c)).join('')}</tr>`),
        '  </tbody>',
        '</table>',
      ].join('\n');
    }
  }
}

export interface TableResult {
  text: string;
  table: Table;
  from: TableFormat;
}

export function tableConverter(
  input: string,
  from: TableFormat | 'auto',
  to: TableFormat,
  options: { align?: Align; pad?: boolean } = {},
): TableResult | undefined {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 5 MB).');
  if (input.trim() === '') return undefined;
  const source = from === 'auto' ? detectFormat(input) : from;
  const table = parseTable(input, source).filter((r) => r.some((c) => c !== ''));
  if (table.length === 0) throw new ToolInputError('The table is empty.');
  return { text: writeTable(table, to, options), table, from: source };
}
