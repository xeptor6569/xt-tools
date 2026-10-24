import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../tests/helpers/expect-robust.ts';
import { parseIpAddress } from './ip-address.ts';

describe('parseIpAddress', () => {
  it('accepts IPv4 and IPv6', () => {
    expect(parseIpAddress('8.8.8.8')).toBe('8.8.8.8');
    expect(parseIpAddress(' 2001:db8::1 ')).toBe('2001:db8::1');
  });

  it('rejects leading zeros, zones and hostnames', () => {
    expect(() => parseIpAddress('01.2.3.4')).toThrow(/not an IPv4 or IPv6/);
    expect(() => parseIpAddress('fe80::1%eth0')).toThrow(/not an IPv4 or IPv6/);
    expect(() => parseIpAddress('example.com')).toThrow(/not an IPv4 or IPv6/);
  });

  it('stays inside ToolInputError for garbage', () => {
    expectRobust(parseIpAddress);
  });
});
