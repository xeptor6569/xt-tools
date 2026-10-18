import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
}

const MAX_INPUT = 1_000_000;

/**
 * Splits text into words: on spaces and punctuation, between a lower-case
 * letter or digit and an upper-case letter ("fooBar"), and before the last
 * capital of an acronym ("XMLHttp" → "XML", "Http").
 */
export function words(text: string): string[] {
  return (
    text
      .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, '$1 $2')
      .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

const cap = (w: string) => w.charAt(0).toLocaleUpperCase('en') + w.slice(1).toLocaleLowerCase('en');
const lower = (w: string) => w.toLocaleLowerCase('en');
const upper = (w: string) => w.toLocaleUpperCase('en');

const FORMATS: Array<[string, (w: string[], line: string) => string]> = [
  ['camelCase', (w) => w.map((x, i) => (i === 0 ? lower(x) : cap(x))).join('')],
  ['PascalCase', (w) => w.map(cap).join('')],
  ['snake_case', (w) => w.map(lower).join('_')],
  ['CONSTANT_CASE', (w) => w.map(upper).join('_')],
  ['kebab-case', (w) => w.map(lower).join('-')],
  ['Train-Case', (w) => w.map(cap).join('-')],
  ['dot.case', (w) => w.map(lower).join('.')],
  ['path/case', (w) => w.map(lower).join('/')],
  ['Title Case', (w) => w.map(cap).join(' ')],
  ['Sentence case', (w) => w.map((x, i) => (i === 0 ? cap(x) : lower(x))).join(' ')],
  ['lower case', (_w, line) => lower(line)],
  ['UPPER CASE', (_w, line) => upper(line)],
];

/** Converts each line of the input to every supported case. */
export function caseConverter(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const lines = input.split('\n').map((line) => [words(line), line] as const);
  return FORMATS.map(([label, format]) => ({
    label,
    value: lines.map(([w, line]) => format(w, line)).join('\n'),
  }));
}
