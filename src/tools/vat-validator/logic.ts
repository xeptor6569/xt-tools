import { ToolInputError } from '../types.ts';

const MAX_INPUT = 40;

interface VatRule {
  codes: readonly string[];
  name: string;
  pattern: RegExp;
}

/**
 * Format checks only. There is no VIES lookup and no national check digit.
 * Patterns follow the published EU VAT number shapes, plus GB.
 */
const RULES: readonly VatRule[] = [
  { codes: ['AT'], name: 'Austria', pattern: /^ATU\d{8}$/ },
  { codes: ['BE'], name: 'Belgium', pattern: /^BE\d{10}$/ },
  { codes: ['BG'], name: 'Bulgaria', pattern: /^BG\d{9,10}$/ },
  { codes: ['CY'], name: 'Cyprus', pattern: /^CY\d{8}[A-Z]$/ },
  { codes: ['CZ'], name: 'Czechia', pattern: /^CZ\d{8,10}$/ },
  { codes: ['DE'], name: 'Germany', pattern: /^DE\d{9}$/ },
  { codes: ['DK'], name: 'Denmark', pattern: /^DK\d{8}$/ },
  { codes: ['EE'], name: 'Estonia', pattern: /^EE\d{9}$/ },
  { codes: ['EL', 'GR'], name: 'Greece', pattern: /^(?:EL|GR)\d{9}$/ },
  { codes: ['ES'], name: 'Spain', pattern: /^ES(?:[A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z]|[A-Z]\d{8})$/ },
  { codes: ['FI'], name: 'Finland', pattern: /^FI\d{8}$/ },
  { codes: ['FR'], name: 'France', pattern: /^FR[0-9A-HJ-NP-Z]{2}\d{9}$/ },
  { codes: ['GB'], name: 'United Kingdom', pattern: /^GB(?:\d{9}|\d{12}|GD\d{3}|HA\d{3})$/ },
  { codes: ['HR'], name: 'Croatia', pattern: /^HR\d{11}$/ },
  { codes: ['HU'], name: 'Hungary', pattern: /^HU\d{8}$/ },
  { codes: ['IE'], name: 'Ireland', pattern: /^IE(?:\d{7}[A-Z]{1,2}|\d[A-Z]\d{5}[A-Z])$/ },
  { codes: ['IT'], name: 'Italy', pattern: /^IT\d{11}$/ },
  { codes: ['LT'], name: 'Lithuania', pattern: /^LT(?:\d{9}|\d{12})$/ },
  { codes: ['LU'], name: 'Luxembourg', pattern: /^LU\d{8}$/ },
  { codes: ['LV'], name: 'Latvia', pattern: /^LV\d{11}$/ },
  { codes: ['MT'], name: 'Malta', pattern: /^MT\d{8}$/ },
  { codes: ['NL'], name: 'Netherlands', pattern: /^NL\d{9}B\d{2}$/ },
  { codes: ['PL'], name: 'Poland', pattern: /^PL\d{10}$/ },
  { codes: ['PT'], name: 'Portugal', pattern: /^PT\d{9}$/ },
  { codes: ['RO'], name: 'Romania', pattern: /^RO\d{2,10}$/ },
  { codes: ['SE'], name: 'Sweden', pattern: /^SE\d{12}$/ },
  { codes: ['SI'], name: 'Slovenia', pattern: /^SI\d{8}$/ },
  { codes: ['SK'], name: 'Slovakia', pattern: /^SK\d{10}$/ },
  { codes: ['XI'], name: 'Northern Ireland', pattern: /^XI(?:\d{9}|\d{12}|GD\d{3}|HA\d{3})$/ },
];

/** Checks the shape of a VAT number. Format only: no VIES and no registry. */
export function vatValidator(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 40 characters).');
  const text = input.trim();
  if (text === '') return '';
  const compact = text.toUpperCase().replace(/[\s.-]/g, '');
  const prefix = compact.slice(0, 2);
  if (!/^[A-Z]{2}/.test(prefix)) {
    throw new ToolInputError('Enter a VAT number starting with a country code, such as DE136695976.');
  }
  const rule = RULES.find((candidate) => candidate.codes.includes(prefix));
  if (!rule) {
    throw new ToolInputError(
      `${prefix} is not a VAT country this tool checks. This check is format only and does not query VIES.`,
    );
  }
  if (!rule.pattern.test(compact)) {
    throw new ToolInputError(
      `${compact} does not match the ${rule.name} VAT format. This check is format only and does not query VIES.`,
    );
  }
  return [
    compact,
    `Country: ${rule.name} (${prefix})`,
    'Status: format-only match',
    'Note: format only; no VIES lookup',
  ].join('\n');
}
