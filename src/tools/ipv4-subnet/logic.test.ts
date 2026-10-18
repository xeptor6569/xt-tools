import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { ipv4Subnet, parseSubnet } from './logic.ts';

const as = (input: string) => Object.fromEntries(ipv4Subnet(input).map((v) => [v.label, v.value]));

describe('ipv4Subnet', () => {
  it('calculates a /24', () => {
    const r = as('192.168.1.10/24');
    expect(r['CIDR notation']).toBe('192.168.1.0/24');
    expect(r['Subnet mask']).toBe('255.255.255.0');
    expect(r['Wildcard mask']).toBe('0.0.0.255');
    expect(r['Broadcast address']).toBe('192.168.1.255');
    expect(r['Usable host range']).toBe('192.168.1.1 – 192.168.1.254');
    expect(r['Usable hosts']).toBe('254');
    expect(r['Address type']).toBe('Private (RFC 1918)');
    expect(r['Address in hex']).toBe('0xC0A8010A');
  });

  it('handles odd prefixes and masks', () => {
    expect(as('172.20.33.7/20')['CIDR notation']).toBe('172.20.32.0/20');
    expect(as('172.20.33.7/20')['Broadcast address']).toBe('172.20.47.255');
    expect(as('10.1.2.3 255.255.252.0')['CIDR notation']).toBe('10.1.0.0/22');
    expect(as('10.1.2.3/255.0.0.0')['Total addresses']).toBe('16,777,216');
  });

  it('follows RFC 3021 for /31 and treats /32 as one host', () => {
    expect(as('10.0.0.0/31')['Usable hosts']).toBe('2');
    expect(as('10.0.0.0/31')['Usable host range']).toBe('10.0.0.0 – 10.0.0.1');
    expect(as('8.8.8.8')['CIDR notation']).toBe('8.8.8.8/32');
    expect(as('8.8.8.8')['Usable hosts']).toBe('1');
  });

  it('covers the whole address space at /0', () => {
    const r = as('1.2.3.4/0');
    expect(r['Total addresses']).toBe('4,294,967,296');
    expect(r['Subnet mask']).toBe('0.0.0.0');
    expect(r['Broadcast address']).toBe('255.255.255.255');
  });

  it.each([
    ['127.0.0.1', 'Loopback'],
    ['100.64.1.1', 'Carrier-grade NAT (RFC 6598)'],
    ['169.254.10.10', 'Link-local'],
    ['203.0.113.5', 'Documentation (RFC 5737)'],
    ['239.1.1.1', 'Multicast'],
    ['1.1.1.1', 'Public'],
  ])('%s is %s', (ip, type) => expect(as(ip)['Address type']).toBe(type));

  it('rejects invalid input', () => {
    for (const bad of ['256.0.0.1', '1.2.3', '1.2.3.4/33', '10.0.0.1 255.0.255.0', '010.0.0.1', 'a.b.c.d']) {
      expect(() => parseSubnet(bad), bad).toThrow(ToolInputError);
    }
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(ipv4Subnet, { malformed: ['1.2.3.4/', '/24', '1.2.3.4//24', '   1.2.3.4   /   8  '] });
  });
});
