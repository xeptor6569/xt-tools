import { ToolInputError } from '../types.ts';

export interface Variant {
  label: string;
  value: string;
  note?: string;
}

const MAX_INPUT = 2_000_000;

/** Heuristic English syllable count (the usual approach for readability formulas). */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|(?<![td])ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

function ease(score: number): string {
  if (score >= 90) return 'Very easy (about age 11)';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly easy';
  if (score >= 60) return 'Plain English (ages 13–15)';
  if (score >= 50) return 'Fairly difficult';
  if (score >= 30) return 'Difficult (college)';
  return 'Very difficult (graduate)';
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export function readability(input: string): Variant[] {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 2 MB).');
  const words = input.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
  if (words.length === 0) return [];
  const sentences = Math.max(1, (input.match(/[.!?]+(?=\s|$)/g) ?? []).length);
  const syl = words.map(syllables);
  const totalSyl = syl.reduce((a, b) => a + b, 0);
  const complex = syl.filter((s) => s >= 3).length;
  const letters = words.join('').length;
  const W = words.length;
  const wps = W / sentences;
  const spw = totalSyl / W;

  const fre = 206.835 - 1.015 * wps - 84.6 * spw;
  const fk = 0.39 * wps + 11.8 * spw - 15.59;
  const fog = 0.4 * (wps + 100 * (complex / W));
  const smog = 1.043 * Math.sqrt(complex * (30 / sentences)) + 3.1291;
  const cli = 0.0588 * ((letters / W) * 100) - 0.296 * ((sentences / W) * 100) - 15.8;
  const ari = 4.71 * (letters / W) + 0.5 * wps - 21.43;

  return [
    { label: 'Flesch reading ease', value: r1(fre), note: ease(fre) },
    { label: 'Flesch–Kincaid grade', value: r1(fk), note: 'US school grade' },
    { label: 'Gunning fog index', value: r1(fog), note: 'Years of education' },
    {
      label: 'SMOG index',
      value: r1(smog),
      note: sentences < 30 ? 'Most reliable with 30+ sentences' : 'Years of education',
    },
    { label: 'Coleman–Liau index', value: r1(cli), note: 'US school grade' },
    { label: 'Automated readability index', value: r1(ari), note: 'US school grade' },
    { label: 'Words', value: String(W) },
    { label: 'Sentences', value: String(sentences) },
    { label: 'Words per sentence', value: r1(wps) },
    { label: 'Syllables per word', value: (Math.round(spw * 100) / 100).toFixed(2) },
    { label: 'Complex words (3+ syllables)', value: `${complex} (${Math.round((complex / W) * 100)}%)` },
  ];
}
