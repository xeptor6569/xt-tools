import { ToolInputError } from '../types.ts';

const MAX_INPUT = 200;

/** Fallback stack used when the browser cannot list installed fonts. */
export const BUILT_IN_FAMILIES = ['Georgia', 'Palatino', 'system-ui', 'sans-serif', 'monospace'] as const;

const GENERIC = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'emoji',
  'math',
  'fangsong',
]);

export interface FontPair {
  heading: string;
  body: string;
  headingStack: string;
  bodyStack: string;
  text: string;
}

function cssFamily(name: string): string {
  if (GENERIC.has(name.toLowerCase())) return name.toLowerCase();
  if (/^[\w-]+$/.test(name)) return name;
  return `"${name.replace(/["\\]/g, '')}"`;
}

function hasForbiddenCharacter(name: string): boolean {
  if (/[{}<>;]/.test(name)) return true;
  for (const char of name) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function assertName(name: string): void {
  if (name.length > 80) throw new ToolInputError('Font names must be 80 characters or fewer.');
  if (hasForbiddenCharacter(name)) {
    throw new ToolInputError('Font names cannot include control characters or CSS punctuation.');
  }
}

function stack(family: string): string {
  const names = [family, ...BUILT_IN_FAMILIES.filter((item) => item.toLowerCase() !== family.toLowerCase())];
  return names.map(cssFamily).join(', ');
}

/** Splits `Heading | Body`. An empty side falls back to Georgia and Palatino. */
export function parseFontPair(input: string): { heading: string; body: string } {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 200 characters).');
  const text = input.trim();
  const parts =
    text === ''
      ? []
      : text
          .split(/\s*(?:\||\/|\n)\s*/)
          .map((part) => part.trim())
          .filter(Boolean);
  if (parts.length > 2) throw new ToolInputError('Enter a heading font and a body font separated by |.');
  const heading = parts[0] || 'Georgia';
  const body = parts[1] || 'Palatino';
  assertName(heading);
  assertName(body);
  return { heading, body };
}

/** Builds the heading and body stacks, including the built-in fallback families. */
export function describeFonts(input: string): FontPair {
  const { heading, body } = parseFontPair(input);
  const headingStack = stack(heading);
  const bodyStack = stack(body);
  const text = [`Heading: ${headingStack}`, `Body: ${bodyStack}`].join('\n');
  return { heading, body, headingStack, bodyStack, text };
}

export function fontPairing(input: string): string {
  return describeFonts(input).text;
}
