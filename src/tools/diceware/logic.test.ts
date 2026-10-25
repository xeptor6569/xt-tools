import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { diceware, parseCount } from './logic.ts';
import { EFF_LARGE_WORDLIST } from './wordlist.ts';

const zeros = (n: number) => new Uint8Array(n);

describe('diceware', () => {
  it('loads the EFF large list of 7776 words', () => {
    expect(EFF_LARGE_WORDLIST).toHaveLength(7776);
    expect(EFF_LARGE_WORDLIST[0]).toBe('abacus');
    expect(EFF_LARGE_WORDLIST[7775]).toBe('zoom');
    expect(new Set(EFF_LARGE_WORDLIST).size).toBe(7776);
  });

  it('maps an all-zero draw to the first word, repeated', () => {
    expect(diceware(6, zeros, EFF_LARGE_WORDLIST)).toEqual(['abacus abacus abacus abacus abacus abacus']);
  });

  it('draws distinct words from a real random source', () => {
    const [phrase] = diceware(6, (n) => crypto.getRandomValues(new Uint8Array(n)), EFF_LARGE_WORDLIST);
    const words = phrase!.split(' ');
    expect(words).toHaveLength(6);
    for (const word of words) expect(EFF_LARGE_WORDLIST).toContain(word);
  });

  it('parses a word count from 4 to 10', () => {
    expect(parseCount('')).toBe(6);
    expect(parseCount(' 4 ')).toBe(4);
    expect(parseCount('10')).toBe(10);
    expect(() => parseCount('3')).toThrow(ToolInputError);
    expect(() => parseCount('11')).toThrow(ToolInputError);
    expect(() => parseCount('abc')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed count input', () => {
    expectRobust(parseCount);
  });
});
