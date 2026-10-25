import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { lookupOui, macVendor, type OuiTable } from './logic.ts';

const sample: OuiTable = {
  AABBCC: 'Short Vendor',
  AABBCCD: 'Medium Vendor',
  AABBCCDDE: 'Long Vendor',
};

describe('macVendor', () => {
  it('uses the longest matching prefix', () => {
    expect(lookupOui('AABBCCDDEEFF', sample)).toBe('Long Vendor');
    expect(lookupOui('AABBCCDD1234', sample)).toBe('Medium Vendor');
    expect(lookupOui('AABBCC112233', sample)).toBe('Short Vendor');
    expect(lookupOui('AA0000112233', sample)).toBeUndefined();
  });

  it('accepts common MAC spellings and reports a miss without throwing', () => {
    expect(macVendor('aa:bb:cc:dd:ee:ff', sample)).toBe('AA:BB:CC:DD:EE:FF\tLong Vendor');
    expect(macVendor('aa-bb-cc-11-22-33', sample)).toBe('AA:BB:CC:11:22:33\tShort Vendor');
    expect(macVendor('aabb.ccdd.eeff', sample)).toBe('AA:BB:CC:DD:EE:FF\tLong Vendor');
    expect(macVendor('AA:00:00:00:00:01', sample)).toBe('AA:00:00:00:00:01\tNot found');
  });

  it('returns nothing for empty input and rejects a bad address', () => {
    expect(macVendor('')).toBe('');
    expect(macVendor('   \n')).toBe('');
    expect(() => macVendor('hello', sample)).toThrow(ToolInputError);
    expect(() => macVendor('00:11', sample)).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => macVendor(input, sample));
  });
});

describe('bundled OUI dataset', () => {
  const table = JSON.parse(
    readFileSync(new URL('../../../public/data/oui-2026-10.json', import.meta.url), 'utf8'),
  ) as OuiTable;

  it('resolves well-known prefixes and a longer assignment inside one', () => {
    expect(macVendor('00:00:0C:11:22:33', table)).toContain('Cisco Systems, Inc');
    expect(macVendor('00:0C:29:00:00:01', table)).toContain('VMware, Inc.');
    expect(macVendor('8C:1F:64:AB:CD:EF', table)).toContain('IEEE Registration Authority');
    expect(macVendor('8C:1F:64:AF:A0:11', table)).toContain('DATA ELECTRONIC DEVICES, INC');
    expect(macVendor('AA:BB:CC:DD:EE:FF', table)).toContain('Not found');
  });

  it('has uppercase hex keys of at least 6 digits', () => {
    const keys = Object.keys(table);
    expect(keys.length).toBeGreaterThan(40_000);
    for (const key of keys.slice(0, 20)) expect(key).toMatch(/^[0-9A-F]{6,}$/);
    expect(table['00000C']).toBe('Cisco Systems, Inc');
  });
});
