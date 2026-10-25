import { ToolInputError } from '../types.ts';

const MAX_INPUT = 80;

interface ParsedPhone {
  number: string;
  country?: string | undefined;
  countryCallingCode: string;
  formatNational: () => string;
  formatInternational: () => string;
  getType: () => string | undefined;
  isValid: () => boolean;
}

interface PhoneLibrary {
  parsePhoneNumberFromString: (text: string, defaultCountry?: string) => ParsedPhone | undefined;
}

let loading: Promise<PhoneLibrary> | undefined;

function library(): Promise<PhoneLibrary> {
  loading ??= import('libphonenumber-js/max')
    .then((mod) => mod as unknown as PhoneLibrary)
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

/** Loads libphonenumber-js/max as its own chunk. The page bundle stays small. */
export function preloadPhoneParser(): Promise<void> {
  return library().then(() => undefined);
}

function countryLabel(code: string | undefined): string {
  if (!code) return 'unknown';
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return code;
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    if (!name || name.toUpperCase() === code.toUpperCase()) return code;
    return `${name} (${code})`;
  } catch {
    return code;
  }
}

/**
 * Parses a phone number. National numbers (no + country code) are read as US
 * numbers. The heavy metadata is loaded with a dynamic import.
 */
export async function phoneParser(input: string): Promise<string> {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 80 characters).');
  const text = input.trim();
  if (text === '') return '';
  if (!/\d/.test(text)) {
    throw new ToolInputError('Enter a phone number. National numbers are read as US numbers.');
  }

  let parsed: ParsedPhone | undefined;
  try {
    const { parsePhoneNumberFromString } = await library();
    parsed = parsePhoneNumberFromString(text, 'US');
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    throw new ToolInputError('That phone number could not be parsed.');
  }
  if (!parsed) throw new ToolInputError('That phone number could not be parsed.');

  const kind = parsed.getType();
  const lines = [
    `E.164: ${parsed.number}`,
    `Country: ${countryLabel(parsed.country)}`,
    `Calling code: +${parsed.countryCallingCode}`,
    `National: ${parsed.formatNational()}`,
    `International: ${parsed.formatInternational()}`,
    kind ? `Type: ${kind.toLowerCase().replaceAll('_', ' ')}` : undefined,
    `Status: ${parsed.isValid() ? 'valid' : 'invalid'}`,
  ];
  return lines.filter((line): line is string => line !== undefined).join('\n');
}
