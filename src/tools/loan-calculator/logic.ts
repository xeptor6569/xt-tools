import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;
const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;

function field(text: string, names: string[]): number {
  const match = new RegExp(`(?:${names.join('|')})\\s*[:=]?\\s*(${NUMBER})%?`, 'i').exec(text);
  if (!match) {
    throw new ToolInputError('Use principal, rate and years, for example: principal 1000 rate 5 years 2.');
  }
  const n = Number(match[1]);
  if (!Number.isFinite(n)) throw new ToolInputError('That number is too large.');
  return n;
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

function formatCents(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function monthlyPayment(principal: number, annualPercent: number, months: number): number {
  if (annualPercent === 0) return principal / months;
  const r = annualPercent / 100 / 12;
  const growth = (1 + r) ** months;
  if (!Number.isFinite(growth)) throw new ToolInputError('Those values are too large to calculate.');
  return (principal * r * growth) / (growth - 1);
}

/**
 * Standard monthly amortization, or monthly compound growth when the line starts with "compound".
 * Rate is the annual percent (5 means 5%).
 */
export function loanCalculator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError(`Input is too long (maximum ${MAX_INPUT} characters).`);
  const text = input.trim();
  if (text === '') return '';
  const compound = /^compound\b/i.test(text);
  const body = text.replace(/^compound\b/i, ' ');
  const principal = field(body, ['principal', 'p']);
  const rate = field(body, ['rate', 'interest', 'apr']);
  const years = field(body, ['years', 'year', 'term']);
  if (principal <= 0) throw new ToolInputError('Principal must be greater than zero.');
  if (principal > 1e12) throw new ToolInputError('Principal is too large.');
  if (rate < 0 || rate > 100) throw new ToolInputError('Enter an annual rate from 0 to 100 percent.');
  if (years <= 0) throw new ToolInputError('Term must be greater than zero.');
  const months = Math.round(years * 12);
  if (months < 1 || months > 1200) throw new ToolInputError('Enter a term from one month to 100 years.');

  if (compound) {
    const r = rate / 100 / 12;
    const future = principal * (1 + r) ** months;
    if (!Number.isFinite(future)) throw new ToolInputError('Those values are too large to calculate.');
    const futureCents = cents(future);
    const principalCents = cents(principal);
    return [
      `Future value: ${formatCents(futureCents)}`,
      `Interest earned: ${formatCents(futureCents - principalCents)}`,
      `Compounding: monthly`,
      `Periods: ${months}`,
    ].join('\n');
  }

  const paymentCents = cents(monthlyPayment(principal, rate, months));
  const principalCents = cents(principal);
  const totalCents = paymentCents * months;
  return [
    `Monthly payment: ${formatCents(paymentCents)}`,
    `Payments: ${months}`,
    `Total paid: ${formatCents(totalCents)}`,
    `Total interest: ${formatCents(totalCents - principalCents)}`,
  ].join('\n');
}
