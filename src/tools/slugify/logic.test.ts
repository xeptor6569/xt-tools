import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { slugify } from './logic.ts';

describe('slugify', () => {
  it.each([
    ['Hello, World!', 'hello-world'],
    ['  Leading and trailing  ', 'leading-and-trailing'],
    ['Ça va? Très bien', 'ca-va-tres-bien'],
    ['Straße & Café', 'strasse-and-cafe'],
    ['Smørrebrød in Łódź', 'smorrebrod-in-lodz'],
    ["Don't stop", 'dont-stop'],
    ['multiple---dashes___and   spaces', 'multiple-dashes-and-spaces'],
    ['Version 2.0 (beta)', 'version-2-0-beta'],
    ['ﬁ ligature', 'fi-ligature'],
    ['Emoji 🚀 rocket', 'emoji-rocket'],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('supports other separators', () => {
    expect(slugify('Hello big World', { separator: '_' })).toBe('hello_big_world');
    expect(slugify('Hello big World', { separator: '.' })).toBe('hello.big.world');
  });

  it('can keep the original case', () => {
    expect(slugify('Hello World', { lowercase: false })).toBe('Hello-World');
  });

  it('returns an empty string for empty or blank input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(' \n\t ')).toBe('');
  });

  it('explains when nothing usable is left', () => {
    expect(() => slugify('日本語')).toThrow(ToolInputError);
    expect(() => slugify('!!!')).toThrow(/no Latin letters or digits/);
  });

  it('rejects input over 1 MB', () => {
    expect(() => slugify('a'.repeat(1_000_001))).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(slugify, { malformed: ['\uFFFF\uFFFE', '-'.repeat(10_000), '&&&&'] });
  });
});
