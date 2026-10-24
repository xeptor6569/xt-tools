import { ToolInputError } from '../types.ts';

/** Currencies published by the European Central Bank through Frankfurter. */
export const CURRENCIES = [
  ['AUD', 'Australian Dollar'],
  ['BRL', 'Brazilian Real'],
  ['CAD', 'Canadian Dollar'],
  ['CHF', 'Swiss Franc'],
  ['CNY', 'Chinese Renminbi Yuan'],
  ['CZK', 'Czech Koruna'],
  ['DKK', 'Danish Krone'],
  ['EUR', 'Euro'],
  ['GBP', 'British Pound'],
  ['HKD', 'Hong Kong Dollar'],
  ['HUF', 'Hungarian Forint'],
  ['IDR', 'Indonesian Rupiah'],
  ['ILS', 'Israeli New Shekel'],
  ['INR', 'Indian Rupee'],
  ['ISK', 'Icelandic Króna'],
  ['JPY', 'Japanese Yen'],
  ['KRW', 'South Korean Won'],
  ['MXN', 'Mexican Peso'],
  ['MYR', 'Malaysian Ringgit'],
  ['NOK', 'Norwegian Krone'],
  ['NZD', 'New Zealand Dollar'],
  ['PHP', 'Philippine Peso'],
  ['PLN', 'Polish Złoty'],
  ['RON', 'Romanian Leu'],
  ['SEK', 'Swedish Krona'],
  ['SGD', 'Singapore Dollar'],
  ['THB', 'Thai Baht'],
  ['TRY', 'Turkish Lira'],
  ['USD', 'United States Dollar'],
  ['ZAR', 'South African Rand'],
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number][0];

const CODES = new Set<string>(CURRENCIES.map(([code]) => code));

export interface Conversion {
  amount: string;
  from: string;
  to: string;
  converted: string;
  rate: string;
  date?: string;
}

export function isCurrency(code: string): code is CurrencyCode {
  return CODES.has(code);
}

export function parseAmount(text: string): number {
  const value = text.trim();
  if (value.length === 0) throw new ToolInputError('Enter an amount.');
  if (value.length > 20 || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) {
    throw new ToolInputError('Enter an amount greater than zero, with up to 6 decimal places.');
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0 || amount > 1_000_000_000_000) {
    throw new ToolInputError('Enter an amount greater than zero and up to 1 trillion.');
  }
  return amount;
}

export function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) throw new ToolInputError('The rate service returned a rate that is not a number.');
  const text = value.toFixed(6).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
}

/** Same-currency conversions stay on this device. A URL means a rate has to be fetched. */
export function currencyUrl(amount: number, from: CurrencyCode, to: CurrencyCode): string | undefined {
  if (from === to) return undefined;
  return `https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}&amount=${amount}`;
}

export function localConversion(amount: number, code: CurrencyCode): Conversion {
  const text = formatDecimal(amount);
  return { amount: text, from: code, to: code, converted: text, rate: '1' };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** `rates[to]` is the converted amount, as Frankfurter returns it when `amount` is set. */
export function parseFrankfurter(json: unknown, from: CurrencyCode, to: CurrencyCode, amount: number): Conversion {
  const record = asRecord(json);
  const rates = asRecord(record?.rates);
  const converted = rates?.[to];
  if (!record || record.base !== from || typeof converted !== 'number' || typeof record.date !== 'string') {
    throw new ToolInputError('The rate service returned an unexpected response.');
  }
  return {
    amount: formatDecimal(amount),
    from,
    to,
    converted: formatDecimal(converted),
    rate: formatDecimal(converted / amount),
    date: record.date,
  };
}
