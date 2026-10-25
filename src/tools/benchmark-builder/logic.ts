import { formatNumber } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;
const MAX_ROWS = 1_000;
const VALUE = /^(.*?[^\s])\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)$/i;

interface Row {
  name: string;
  value: number;
}

/**
 * Compare measurements the user already has. Lower is faster.
 * This never parses or runs the names as code.
 */
export function benchmarkBuilder(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const rows: Row[] = [];
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = VALUE.exec(line);
    if (!match) throw new ToolInputError(`Can't read "${line}". Use "name value" on each line.`);
    const name = match[1]!;
    const value = Number(match[2]);
    if (!Number.isFinite(value)) throw new ToolInputError(`"${name}" has a value that is too large.`);
    if (value < 0) throw new ToolInputError('Values must be zero or positive. Lower is faster.');
    rows.push({ name, value });
    if (rows.length > MAX_ROWS) throw new ToolInputError(`Enter at most ${MAX_ROWS} rows.`);
  }
  if (rows.length === 0) return '';
  rows.sort((a, b) => a.value - b.value || a.name.localeCompare(b.name));
  const best = rows[0]!.value;
  return rows
    .map((row, index) => {
      let relative: string;
      if (best === 0) relative = row.value === 0 ? '1×' : 'n/a';
      else relative = `${formatNumber(row.value / best)}×`;
      const mark = row.value === best ? '  fastest' : '';
      return `${index + 1}. ${row.name}  ${formatNumber(row.value)}  ${relative}${mark}`;
    })
    .join('\n');
}
