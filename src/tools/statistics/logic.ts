import { formatNumber } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_VALUES = 100_000;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function parseNumbers(input: string): number[] {
  const parts = input
    .trim()
    .split(/[\s,]+/)
    .filter((part) => part !== '');
  if (parts.length > MAX_VALUES) throw new ToolInputError(`Enter at most ${MAX_VALUES} numbers.`);
  return parts.map((part) => {
    if (!NUMBER.test(part)) throw new ToolInputError(`"${part}" is not a number.`);
    const n = Number(part);
    if (!Number.isFinite(n)) throw new ToolInputError(`"${part}" is too large.`);
    return n;
  });
}

/**
 * Median of a sorted list. Quartiles are Tukey hinges: the medians of the
 * lower and upper halves, excluding the overall median when the count is odd.
 */
function median(sorted: readonly number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function sampleStdev(values: readonly number[], mean: number): number | undefined {
  if (values.length < 2) return undefined;
  let sum = 0;
  for (const value of values) {
    const d = value - mean;
    sum += d * d;
  }
  return Math.sqrt(sum / (values.length - 1));
}

/** Count, extremes, sum, mean, median, sample standard deviation and quartiles. */
export function statistics(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const values = parseNumbers(input);
  if (values.length === 0) throw new ToolInputError('Enter at least one number.');
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  for (const value of sorted) sum += value;
  const mean = sum / n;
  const mid = Math.floor(n / 2);
  const lower = sorted.slice(0, n % 2 === 1 ? mid : mid);
  const upper = sorted.slice(n % 2 === 1 ? mid + 1 : mid);
  const q1 = median(lower.length > 0 ? lower : sorted);
  const q2 = median(sorted);
  const q3 = median(upper.length > 0 ? upper : sorted);
  const stdev = sampleStdev(values, mean);
  const min = sorted[0]!;
  const max = sorted[n - 1]!;
  return [
    `Count: ${n}`,
    `Min: ${formatNumber(min)}`,
    `Max: ${formatNumber(max)}`,
    `Sum: ${formatNumber(sum)}`,
    `Mean: ${formatNumber(mean)}`,
    `Median: ${formatNumber(q2)}`,
    `Sample standard deviation: ${stdev === undefined ? 'n/a' : formatNumber(stdev)}`,
    `Q1: ${formatNumber(q1)}`,
    `Q2: ${formatNumber(q2)}`,
    `Q3: ${formatNumber(q3)}`,
  ].join('\n');
}
