import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { wildcardMask } from './logic.ts';

const as = (input: string) => Object.fromEntries(wildcardMask(input).map((row) => [row.label, row.value]));

describe('wildcardMask', () => {
  it('converts a prefix length', () => {
    expect(as('/24')).toEqual({
      'Prefix length': '/24',
      'Subnet mask': '255.255.255.0',
      'Wildcard mask': '0.0.0.255',
    });
    expect(as('24')['Wildcard mask']).toBe('0.0.0.255');
    expect(as('/0')['Subnet mask']).toBe('0.0.0.0');
    expect(as('32')['Wildcard mask']).toBe('0.0.0.0');
  });

  it('converts a dotted mask and a wildcard', () => {
    expect(as('255.255.255.0')['Prefix length']).toBe('/24');
    expect(as('255.255.254.0')).toMatchObject({ 'Prefix length': '/23', 'Wildcard mask': '0.0.1.255' });
    expect(as('0.0.0.255')['Subnet mask']).toBe('255.255.255.0');
    expect(as('0.0.1.255')['Prefix length']).toBe('/23');
  });

  it('honours an explicit keyword when the value is all zeros or all ones', () => {
    expect(as('0.0.0.0')['Prefix length']).toBe('/0');
    expect(as('wildcard 0.0.0.0')['Prefix length']).toBe('/32');
    expect(as('mask 255.255.255.255')['Wildcard mask']).toBe('0.0.0.0');
    expect(as('prefix 20')['Subnet mask']).toBe('255.255.240.0');
  });

  it('rejects a non-contiguous mask', () => {
    expect(wildcardMask('')).toEqual([]);
    expect(() => wildcardMask('255.0.255.0')).toThrow(ToolInputError);
    expect(() => wildcardMask('/33')).toThrow(ToolInputError);
    expect(() => wildcardMask('hello')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(wildcardMask, { malformed: ['/', 'mask', 'wildcard 1.2.3.4.5'] });
  });
});
