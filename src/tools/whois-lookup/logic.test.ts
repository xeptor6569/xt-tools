import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { parseRdap, whoisUrl } from './logic.ts';

describe('whoisUrl', () => {
  it('points .com and .net at Verisign and .org at the public interest registry', () => {
    expect(whoisUrl('Example.COM')).toBe('https://rdap.verisign.com/com/v1/domain/example.com');
    expect(whoisUrl('example.net.')).toBe('https://rdap.verisign.com/net/v1/domain/example.net');
    expect(whoisUrl('example.org')).toBe('https://rdap.publicinterestregistry.org/rdap/domain/example.org');
  });

  it('points an IP address at ARIN', () => {
    expect(whoisUrl('8.8.8.8')).toBe('https://rdap.arin.net/registry/ip/8.8.8.8');
    expect(whoisUrl('2001:db8::1')).toBe('https://rdap.arin.net/registry/ip/2001:db8::1');
  });

  it('refuses suffixes this page cannot reach', () => {
    expect(() => whoisUrl('example.co.uk')).toThrow(/\.com, \.net and \.org/);
    expect(() => whoisUrl('https://example.com')).toThrow(/not a URL/);
  });

  it('stays inside ToolInputError for garbage', () => {
    expectRobust(whoisUrl);
  });
});

describe('parseRdap', () => {
  it('reads the example.com registration record', () => {
    const rows = parseRdap({
      ldhName: 'EXAMPLE.COM',
      handle: '2336799_DOMAIN_COM-VRSN',
      status: ['client delete prohibited', 'client transfer prohibited'],
      nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }, { ldhName: 'B.IANA-SERVERS.NET' }],
      entities: [
        {
          handle: '376',
          roles: ['registrar'],
          vcardArray: ['vcard', [['fn', {}, 'text', 'RESERVED-Internet Assigned Numbers Authority']]],
        },
      ],
      events: [{ eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' }],
    });
    expect(rows).toEqual([
      { label: 'Name', value: 'EXAMPLE.COM' },
      { label: 'Handle', value: '2336799_DOMAIN_COM-VRSN' },
      { label: 'Status', value: 'client delete prohibited, client transfer prohibited' },
      { label: 'Nameservers', value: 'A.IANA-SERVERS.NET, B.IANA-SERVERS.NET' },
      { label: 'Contacts', value: 'RESERVED-Internet Assigned Numbers Authority (registrar)' },
      { label: 'Events', value: 'registration: 1995-08-14T04:00:00Z' },
    ]);
  });

  it('reads an ARIN network allocation', () => {
    expect(
      parseRdap({
        name: 'GOGL',
        handle: 'NET-8-8-8-0-1',
        startAddress: '8.8.8.0',
        endAddress: '8.8.8.255',
        cidr0_cidrs: [{ v4prefix: '8.8.8.0', length: 24 }],
      }),
    ).toEqual([
      { label: 'Name', value: 'GOGL' },
      { label: 'Handle', value: 'NET-8-8-8-0-1' },
      { label: 'Range', value: '8.8.8.0 – 8.8.8.255' },
      { label: 'CIDR', value: '8.8.8.0/24' },
    ]);
  });
});
