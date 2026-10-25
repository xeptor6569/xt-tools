import { formatNumber } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;
const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;

function num(text: string): number {
  const n = Number(text);
  if (!Number.isFinite(n)) throw new ToolInputError('That number is too large.');
  return n;
}

function line(text: string): string {
  const of = new RegExp(String.raw`^(?:what\s+is\s+)?(${NUMBER})\s*(?:%|percent)\s+of\s+(${NUMBER})$`, 'i').exec(text);
  if (of) return formatNumber((num(of[1]!) / 100) * num(of[2]!));

  const what = new RegExp(String.raw`^(${NUMBER})\s+is\s+what\s+(?:%|percent)\s+of\s+(${NUMBER})$`, 'i').exec(text);
  if (what) {
    const whole = num(what[2]!);
    if (whole === 0) throw new ToolInputError('Cannot divide by zero.');
    return `${formatNumber((num(what[1]!) / whole) * 100)}%`;
  }

  const reverse = new RegExp(String.raw`^(${NUMBER})\s+is\s+(${NUMBER})\s*(?:%|percent)\s+of\s+what$`, 'i').exec(text);
  if (reverse) {
    const pct = num(reverse[2]!);
    if (pct === 0) throw new ToolInputError('Cannot divide by zero.');
    return formatNumber(num(reverse[1]!) / (pct / 100));
  }

  const change = new RegExp(String.raw`^from\s+(${NUMBER})\s+to\s+(${NUMBER})$`, 'i').exec(text);
  if (change) {
    const from = num(change[1]!);
    const to = num(change[2]!);
    if (from === 0) throw new ToolInputError('Cannot measure a percent change from zero.');
    const delta = to - from;
    const pct = (delta / from) * 100;
    const direction = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'change';
    const sign = delta > 0 ? '+' : '';
    return `${formatNumber(Math.abs(pct))}% ${direction} (${sign}${formatNumber(delta)})`;
  }

  throw new ToolInputError(`Can't read "${text}". Try "20% of 80", "20 is what % of 80", or "from 80 to 100".`);
}

/** One calculation per line: a percent of a value, a ratio, a reverse percent, or a change. */
export function percentageCalculator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const lines = input
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item !== '');
  if (lines.length === 0) return '';
  return lines.map(line).join('\n');
}
