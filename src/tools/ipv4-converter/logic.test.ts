import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { ipv4Converter } from './logic.ts';

const as = (input: string) => Object.fromEntries(ipv4Converter(input).map((row) => [row.label, row.value]));

describe('ipv4Converter', () => {
  it('converts dotted decimal to every form', () => {
    const row = as('192.168.1.1');
    expect(row['Dotted decimal']).toBe('192.168.1.1');
    expect(row['Decimal']).toBe('3232235777');
    expect(row['Hexadecimal']).toBe('0xC0A80101');
    expect(row['Binary']).toBe('11000000.10101000.00000001.00000001');
  });

  it('detects decimal, hex and binary', () => {
    expect(as('3232235777')['Dotted decimal']).toBe('192.168.1.1');
    expect(as('0xC0A80101')['Dotted decimal']).toBe('192.168.1.1');
    expect(as('0xc0a80101')['Decimal']).toBe('3232235777');
    expect(as('C0A80101')['Dotted decimal']).toBe('192.168.1.1');
    expect(as('11000000101010000000000100000001')['Dotted decimal']).toBe('192.168.1.1');
    expect(as('11000000.10101000.00000001.00000001')['Decimal']).toBe('3232235777');
    expect(as('11000000 10101000 00000001 00000001')['Dotted decimal']).toBe('192.168.1.1');
  });

  it('covers the ends of the address space', () => {
    expect(as('0.0.0.0')['Decimal']).toBe('0');
    expect(as('255.255.255.255')['Hexadecimal']).toBe('0xFFFFFFFF');
    expect(as('4294967295')['Dotted decimal']).toBe('255.255.255.255');
  });

  it('treats a short run of ones as a decimal integer', () => {
    expect(as('11111111')['Dotted decimal']).toBe('0.169.138.199');
  });

  it('returns nothing for empty input and rejects garbage', () => {
    expect(ipv4Converter('')).toEqual([]);
    expect(ipv4Converter('   ')).toEqual([]);
    for (const bad of ['hello', '256.1.1.1', '01.2.3.4', '192.168.1', '4294967296', '0x1ffffffff']) {
      expect(() => ipv4Converter(bad), bad).toThrow(ToolInputError);
    }
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(ipv4Converter, { malformed: ['192.168.1.1/24', '0x', ':::'] });
  });
});
