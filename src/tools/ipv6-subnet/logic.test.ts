import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { ipv6Subnet } from './logic.ts';

const as = (input: string) => Object.fromEntries(ipv6Subnet(input).map((row) => [row.label, row.value]));

describe('ipv6Subnet', () => {
  it('compresses and expands per RFC 5952', () => {
    const row = as('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(row['Compressed']).toBe('2001:db8::1');
    expect(row['Expanded']).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(as('2001:DB8::1')['Compressed']).toBe('2001:db8::1');
    expect(as('2001:db8:0:0:1:0:0:1')['Compressed']).toBe('2001:db8::1:0:0:1');
    expect(as('2001:0:0:1:0:0:1:1')['Compressed']).toBe('2001::1:0:0:1:1');
    expect(as('::')['Compressed']).toBe('::');
    expect(as('::ffff:192.0.2.1')['Compressed']).toBe('::ffff:c000:201');
  });

  it('shows the network, first and last address of a prefix', () => {
    const row = as('2001:db8::1/64');
    expect(row['Network']).toBe('2001:db8::/64');
    expect(row['First address']).toBe('2001:db8::');
    expect(row['Last address']).toBe('2001:db8::ffff:ffff:ffff:ffff');
    expect(as('2001:db8::/32')['Last address']).toBe('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff');
    expect(as('::/0')['Last address']).toBe('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
    expect(as('2001:db8::1')['Prefix length']).toBe('/128');
    expect(as('2001:db8::1')['First address']).toBe('2001:db8::1');
    expect(as('2001:db8::1')['Last address']).toBe('2001:db8::1');
  });

  it('accepts a bracketed address and rejects bad prefixes', () => {
    expect(as('[2001:db8::1]/64')['Network']).toBe('2001:db8::/64');
    expect(ipv6Subnet('')).toEqual([]);
    for (const bad of ['2001:db8::1/129', '2001:db8:::1', 'gggg::1', 'fe80::1%eth0', '2001:db8::1/']) {
      expect(() => ipv6Subnet(bad), bad).toThrow(ToolInputError);
    }
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(ipv6Subnet, { malformed: [':::', '2001:db8::1/x', '1:2:3:4:5:6:7:8:9'] });
  });
});
