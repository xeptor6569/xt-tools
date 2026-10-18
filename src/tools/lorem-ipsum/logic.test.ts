import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { loremIpsum, parseCount } from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

describe('loremIpsum', () => {
  it('generates the requested number of words, sentences and paragraphs', () => {
    expect(loremIpsum(12, 'words', random).split(' ')).toHaveLength(12);
    expect(loremIpsum(5, 'sentences', random).match(/\./g)).toHaveLength(5);
    expect(loremIpsum(3, 'paragraphs', random).split('\n\n')).toHaveLength(3);
  });

  it('starts with "Lorem ipsum" unless told not to', () => {
    expect(loremIpsum(3, 'words', random)).toBe('Lorem ipsum dolor');
    expect(loremIpsum(1, 'sentences', random)).toBe('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
    expect(loremIpsum(1, 'paragraphs', random).startsWith('Lorem ipsum dolor sit amet')).toBe(true);
    const zeros = (n: number) => new Uint8Array(n);
    expect(loremIpsum(2, 'words', zeros, false)).toBe('Lorem lorem');
  });

  it('writes capitalised sentences ending in full stops', () => {
    for (const s of loremIpsum(20, 'sentences', random, false).split(/(?<=\.) /))
      expect(s).toMatch(/^[A-Z][a-z ,]+\.$/);
  });

  it('parses the count', () => {
    expect(parseCount('7')).toBe(7);
    expect(() => parseCount('0')).toThrow(ToolInputError);
    expect(() => parseCount('9999')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed count input', () => {
    expectRobust(parseCount);
  });
});
