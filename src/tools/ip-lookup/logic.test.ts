import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ipifyUrl, ipwhoUrl, parseIpQuery, parseIpify, parseIpwho } from './logic.ts';

describe('parseIpQuery', () => {
  it('treats a blank field as this connection', () => {
    expect(parseIpQuery('  ')).toEqual({ kind: 'self' });
  });

  it('accepts an address and rejects a hostname', () => {
    expect(parseIpQuery('8.8.8.8')).toEqual({ kind: 'address', address: '8.8.8.8' });
    expect(() => parseIpQuery('example.com')).toThrow(/not an IPv4 or IPv6/);
  });

  it('stays inside ToolInputError for garbage', () => {
    expectRobust(parseIpQuery);
  });
});

describe('lookup URLs', () => {
  it('keeps the address in the path and leaves this-connection on the origin', () => {
    expect(ipifyUrl(4)).toBe('https://api.ipify.org?format=json');
    expect(ipifyUrl(6)).toBe('https://api64.ipify.org?format=json');
    expect(ipwhoUrl()).toBe('https://ipwho.is/');
    expect(ipwhoUrl('8.8.8.8')).toBe('https://ipwho.is/8.8.8.8');
  });
});

describe('parsers', () => {
  it('reads an ipify address', () => {
    expect(parseIpify({ ip: '8.8.8.8' })).toBe('8.8.8.8');
    expect(() => parseIpify({ ip: 'not-an-ip' })).toThrow(/not an IPv4 or IPv6/);
  });

  it('reads the location fields and drops the flag and readme', () => {
    expect(
      parseIpwho({
        ip: '8.8.8.8',
        success: true,
        type: 'IPv4',
        city: 'San Jose',
        region: 'California',
        country: 'United States',
        latitude: 37.3393939,
        longitude: -121.8949553,
        timezone: { id: 'America/Los_Angeles', utc: '-07:00' },
        connection: { asn: 15169, isp: 'Google LLC' },
        flag: { emoji: 'skip' },
        readme: 'https://ipwhois.io',
      }),
    ).toEqual([
      { label: 'IP address', value: '8.8.8.8' },
      { label: 'Type', value: 'IPv4' },
      { label: 'Location', value: 'San Jose, California, United States' },
      { label: 'Coordinates', value: '37.3393939, -121.8949553' },
      { label: 'Time zone', value: 'America/Los_Angeles (UTC-07:00)' },
      { label: 'Network', value: 'Google LLC' },
      { label: 'ASN', value: 'AS15169' },
    ]);
  });

  it('surfaces a failed lookup', () => {
    expect(() => parseIpwho({ success: false, message: 'Invalid IP address' })).toThrow(/Invalid IP address/);
  });
});
