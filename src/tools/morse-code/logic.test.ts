import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { decode, encode, morseCode, timings } from './logic.ts';

describe('morse code', () => {
  it('encodes letters, digits and punctuation', () => {
    expect(encode('SOS').morse).toBe('... --- ...');
    expect(encode('Hi 42!').morse).toBe('.... .. / ....- ..--- -.-.--');
    expect(encode('Café').morse).toBe('-.-. .- ..-. .');
  });

  it('reports characters that have no Morse code', () => {
    expect(encode('a#b').skipped).toEqual(['#']);
  });

  it('decodes with slashes, pipes or wide gaps between words', () => {
    expect(decode('.... .. / ....- ..---')).toBe('HI 42');
    expect(decode('... --- ...   .- .-')).toBe('SOS AA');
    expect(decode('·−· −−−')).toBe('RO');
    expect(decode('........')).toBe('�');
    expect(() => decode('.-x')).toThrow(ToolInputError);
  });

  it('detects the direction', () => {
    expect(morseCode('... --- ...').text).toBe('SOS');
    expect(morseCode('sos').text).toBe('... --- ...');
  });

  it('times dots, dashes and gaps (PARIS = 50 units)', () => {
    const units = timings(encode('PARIS').morse).reduce((sum, t) => sum + t.units, 0);
    expect(units + 7).toBe(50);
    expect(timings('. -')).toEqual([
      { on: true, units: 1 },
      { on: false, units: 3 },
      { on: true, units: 3 },
    ]);
  });

  it('round-trips', () => {
    expect(decode(encode('THE QUICK BROWN FOX 123').morse)).toBe('THE QUICK BROWN FOX 123');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => morseCode(s));
    expectRobust((s) => morseCode(s, 'decode'), { malformed: ['...---...', '/ / /'] });
  });
});
