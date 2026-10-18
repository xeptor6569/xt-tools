import { ToolInputError } from '../types.ts';

/** Returns `n` random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;
export type Unit = 'paragraphs' | 'sentences' | 'words';

export const MAX_COUNT = 500;

const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in ' +
  'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa ' +
  'qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc vitae placerat massa vel sapien ' +
  'integer feugiat scelerisque varius morbi blandit cursus risus at ultrices mi tempus imperdiet nulla malesuada pellentesque'
).split(' ');
const OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 1;
  if (!/^\d+$/.test(trimmed)) throw new ToolInputError('Enter a whole number.');
  const n = Number(trimmed);
  if (n < 1 || n > MAX_COUNT) throw new ToolInputError(`Enter a number from 1 to ${MAX_COUNT}.`);
  return n;
}

/** Uniform integer in [0, max) from random bytes. */
function pick(random: RandomBytes, max: number): number {
  const [a = 0, b = 0] = random(2);
  return ((a << 8) | b) % max;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function sentence(random: RandomBytes): string {
  const length = 6 + pick(random, 10);
  const words = Array.from({ length }, () => WORDS[pick(random, WORDS.length)]!);
  // Occasionally add a comma, like real prose.
  if (length > 9) words[3 + pick(random, length - 6)] += ',';
  return `${capitalize(words.join(' '))}.`;
}

function paragraph(random: RandomBytes): string {
  return Array.from({ length: 4 + pick(random, 4) }, () => sentence(random)).join(' ');
}

export function loremIpsum(count: number, unit: Unit, random: RandomBytes, startWithLorem = true): string {
  let text: string;
  if (unit === 'words') {
    const words = Array.from({ length: count }, () => WORDS[pick(random, WORDS.length)]!);
    if (startWithLorem)
      OPENING.toLowerCase()
        .replace(/,/g, '')
        .split(' ')
        .slice(0, count)
        .forEach((w, i) => (words[i] = w));
    text = capitalize(words.join(' '));
  } else if (unit === 'sentences') {
    const sentences = Array.from({ length: count }, () => sentence(random));
    if (startWithLorem) sentences[0] = `${OPENING}.`;
    text = sentences.join(' ');
  } else {
    const paragraphs = Array.from({ length: count }, () => paragraph(random));
    if (startWithLorem) paragraphs[0] = `${OPENING}. ${paragraphs[0]}`;
    text = paragraphs.join('\n\n');
  }
  return text;
}
