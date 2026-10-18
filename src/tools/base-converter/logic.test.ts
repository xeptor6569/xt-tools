import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { baseConverter, parseInteger } from './logic.ts';

const as = (input: string, opts = {}) => Object.fromEntries(baseConverter(input, opts).map((v) => [v.label, v.value]));

describe('parseInteger', () => {
  it.each([
    ['255', 'auto', 255n],
    ['0xff', 'auto', 255n],
    ['0b1010', 'auto', 10n],
    ['0o17', 'auto', 15n],
    ['ff', 16, 255n],
    ['0xFF', 16, 255n],
    ['zz', 36, 1295n],
    ['-101', 2, -5n],
    ['1_000_000', 'auto', 1_000_000n],
    ['1,234', 'auto', 1234n],
  ] as const)('%s (base %s)', (text, base, value) => expect(parseInteger(text, base)).toBe(value));

  it('handles numbers far beyond 64 bits', () => {
    expect(parseInteger('0x' + 'f'.repeat(64))).toBe(2n ** 256n - 1n);
  });

  it('rejects invalid digits', () => {
    expect(() => parseInteger('12a')).toThrow(/isn't a valid digit in base 10/);
    expect(() => parseInteger('2', 2)).toThrow(ToolInputError);
    expect(() => parseInteger('-')).toThrow(ToolInputError);
  });
});

describe('baseConverter', () => {
  it('converts to every common base', () => {
    expect(as('3735928559')).toEqual({
      'Binary (base 2)': '11011110101011011011111011101111',
      'Octal (base 8)': '33653337357',
      'Decimal (base 10)': '3735928559',
      'Hexadecimal (base 16)': 'DEADBEEF',
      'Base 32 (radix)': '3farfnf',
      'Base 36': '1ps9wxb',
      'Bit length': '32',
    });
  });

  it('groups digits and adds a custom base', () => {
    const r = as('0xdeadbeef', { grouped: true, custom: 7 });
    expect(r['Binary (base 2)']).toBe('1101 1110 1010 1101 1011 1110 1110 1111');
    expect(r['Decimal (base 10)']).toBe('3,735,928,559');
    expect(r['Base 7']).toBe((3735928559).toString(7).replace(/\B(?=(\d{4})+$)/g, ' '));
  });

  it('keeps the sign', () => {
    expect(as('-255')['Hexadecimal (base 16)']).toBe('-FF');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => baseConverter(s), { malformed: ['0x', '--5', '1e10', '0b2'] });
  });
});
