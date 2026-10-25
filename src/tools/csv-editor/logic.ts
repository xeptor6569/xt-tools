import { CsvError, parseCsv, writeCsv } from '../../lib/csv.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const PREVIEW_ROWS = 80;
const PREVIEW_COLS = 12;
const PREVIEW_CELL = 40;

function readRows(input: string): string[][] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  try {
    return parseCsv(input);
  } catch (error) {
    if (error instanceof CsvError) throw new ToolInputError(error.message);
    throw error;
  }
}

/** Parses CSV (RFC 4180) and writes it back in a canonical form. */
export function csvEditor(input: string): string {
  return writeCsv(readRows(input));
}

/** Swaps rows and columns. Short rows are padded with empty cells. */
export function transposeCsv(input: string): string {
  const rows = readRows(input);
  if (rows.length === 0) return '';
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const transposed: string[][] = [];
  for (let column = 0; column < width; column++) {
    transposed.push(rows.map((row) => row[column] ?? ''));
  }
  return writeCsv(transposed);
}

/** Drops rows whose cells are all empty or whitespace. */
export function deleteEmptyRows(input: string): string {
  const rows = readRows(input).filter((row) => row.some((cell) => cell.trim() !== ''));
  return writeCsv(rows);
}

function clip(value: string): string {
  const flat = Array.from(value.replace(/\r?\n/g, ' '));
  if (flat.length <= PREVIEW_CELL) return flat.join('');
  return `${flat.slice(0, PREVIEW_CELL - 1).join('')}…`;
}

/** A monospace text table of the CSV, truncated for display. */
export function csvTextTable(input: string): string {
  const rows = readRows(input);
  if (rows.length === 0) return '';
  const shown = rows.slice(0, PREVIEW_ROWS).map((row) => row.slice(0, PREVIEW_COLS).map(clip));
  const width = shown.reduce((max, row) => Math.max(max, row.length), 0);
  const widths = Array.from({ length: width }, (_, column) =>
    shown.reduce((max, row) => Math.max(max, Array.from(row[column] ?? '').length), 1),
  );
  const lines = shown.map((row) => widths.map((size, column) => (row[column] ?? '').padEnd(size)).join(' | '));
  if (shown.length > 1 && lines[0]) {
    const rule = widths.map((size) => '-'.repeat(size)).join('-+-');
    lines.splice(1, 0, rule);
  }
  if (rows.length > PREVIEW_ROWS || rows.some((row) => row.length > PREVIEW_COLS)) {
    lines.push('… preview truncated');
  }
  return lines.join('\n');
}
