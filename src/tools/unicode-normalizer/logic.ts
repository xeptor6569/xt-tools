import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
  note?: string;
}

const MAX_INPUT = 2_000_000;
const FORMS = [
  ['NFC', 'Composed (recommended for storage and the web)'],
  ['NFD', 'Decomposed: letters and accents as separate code points'],
  ['NFKC', 'Compatibility composed: also folds ligatures, widths and styled letters'],
  ['NFKD', 'Compatibility decomposed'],
] as const;

const count = (s: string) => [...s].length;

export function unicodeNormalizer(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 2 MB).');
  if (input === '') return [];
  const out: Variant[] = FORMS.map(([form, description]) => {
    const value = input.normalize(form);
    const changed = value !== input;
    return {
      label: form,
      value,
      note: `${description}. ${changed ? `Changed: ${count(input)} → ${count(value)} code points.` : 'Already in this form.'}`,
    };
  });
  out.push({
    label: 'Without accents',
    value: input
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .normalize('NFC'),
    note: 'Decomposes, then removes combining marks (é → e). Lossy.',
  });
  return out;
}
