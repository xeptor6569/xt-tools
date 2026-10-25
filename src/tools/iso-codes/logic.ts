import { ToolInputError } from '../types.ts';

const MAX_INPUT = 80;
const MAX_SHOWN = 12;

type Kind = 'Country' | 'Currency' | 'Language';
type NameType = 'region' | 'currency' | 'language';

interface Hit {
  kind: Kind;
  code: string;
  name: string;
}

/**
 * Lists codes for a category. When `Intl.supportedValuesOf` rejects the key,
 * the fallback list is used instead.
 */
export function codesFor(key: string, fallback: readonly string[]): readonly string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      const values = intl.supportedValuesOf(key);
      if (Array.isArray(values) && values.length > 0) return values;
    } catch {
      // This runtime cannot list that category.
    }
  }
  return fallback;
}

function alpha2(lower = false): string[] {
  const codes: string[] = [];
  for (let i = 65; i <= 90; i++) {
    for (let j = 65; j <= 90; j++) {
      const code = String.fromCharCode(i, j);
      codes.push(lower ? code.toLowerCase() : code);
    }
  }
  return codes;
}

function namers(): Record<NameType, Intl.DisplayNames> | undefined {
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return undefined;
  return {
    region: new Intl.DisplayNames(['en'], { type: 'region' }),
    currency: new Intl.DisplayNames(['en'], { type: 'currency' }),
    language: new Intl.DisplayNames(['en'], { type: 'language' }),
  };
}

function readName(names: Intl.DisplayNames, code: string): string | undefined {
  try {
    const name = names.of(code);
    if (!name) return undefined;
    if (name.toUpperCase() === code.toUpperCase()) return undefined;
    if (/^unknown\b/i.test(name) || name === 'root') return undefined;
    return name;
  } catch {
    return undefined;
  }
}

let catalog: Hit[] | undefined;

function getCatalog(): Hit[] {
  if (catalog) return catalog;
  const names = namers();
  if (!names) return [];
  const hits: Hit[] = [];
  for (const code of codesFor('region', alpha2())) {
    if (!/^[A-Za-z]{2}$/.test(code)) continue;
    const name = readName(names.region, code.toUpperCase());
    if (name) hits.push({ kind: 'Country', code: code.toUpperCase(), name });
  }
  for (const code of codesFor('currency', [])) {
    const name = readName(names.currency, code.toUpperCase());
    if (name) hits.push({ kind: 'Currency', code: code.toUpperCase(), name });
  }
  for (const code of codesFor('language', alpha2(true))) {
    const name = readName(names.language, code);
    if (name) hits.push({ kind: 'Language', code: code.toLowerCase(), name });
  }
  catalog = hits;
  return hits;
}

function exactHits(query: string): Hit[] {
  const names = namers();
  if (!names) return [];
  const hits: Hit[] = [];
  if (/^[A-Za-z]{2}$/.test(query)) {
    const country = readName(names.region, query.toUpperCase());
    if (country) hits.push({ kind: 'Country', code: query.toUpperCase(), name: country });
    const language = readName(names.language, query.toLowerCase());
    if (language) hits.push({ kind: 'Language', code: query.toLowerCase(), name: language });
  } else if (/^[A-Za-z]{3}$/.test(query)) {
    const currency = readName(names.currency, query.toUpperCase());
    if (currency) hits.push({ kind: 'Currency', code: query.toUpperCase(), name: currency });
    const language = readName(names.language, query.toLowerCase());
    if (language) hits.push({ kind: 'Language', code: query.toLowerCase(), name: language });
  }
  return hits;
}

function formatHits(hits: readonly Hit[]): string {
  const shown = hits.slice(0, MAX_SHOWN);
  const lines = shown.map((hit) => `${hit.kind}: ${hit.name} (${hit.code})`);
  if (hits.length > shown.length) lines.unshift(`Showing ${shown.length} of ${hits.length} matches`);
  return lines.join('\n');
}

/** Looks up a country, currency or language from a code or a name. */
export function isoCodes(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 80 characters).');
  const query = input.trim();
  if (query === '') return '';
  if (!namers()) {
    throw new ToolInputError('This runtime has no Intl.DisplayNames, so codes cannot be looked up.');
  }
  const exact = exactHits(query);
  if (exact.length > 0) return formatHits(exact);
  if (query.length < 2) {
    throw new ToolInputError('Enter a code such as US, USD or en, or at least 2 letters of a name.');
  }
  const needle = query.toLowerCase();
  const rank = (hit: Hit) => {
    const name = hit.name.toLowerCase();
    if (hit.code.toLowerCase() === needle || name === needle) return 0;
    if (name.startsWith(needle)) return 1;
    if (name.split(/[^a-z0-9]+/).includes(needle)) return 2;
    return 3;
  };
  const hits = getCatalog()
    .filter((hit) => hit.code.toLowerCase() === needle || hit.name.toLowerCase().includes(needle))
    .sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name));
  if (hits.length === 0) throw new ToolInputError(`No country, currency or language matches "${query}".`);
  return formatHits(hits);
}
