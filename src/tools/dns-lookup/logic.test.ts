import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { dnsUrl, parseDoh, parseDnsName } from './logic.ts';

const EXAMPLE_A = {
  Status: 0,
  Answer: [
    { name: 'example.com', type: 1, TTL: 84, data: '104.20.23.154' },
    { name: 'example.com', type: 1, TTL: 84, data: '172.66.147.243' },
  ],
};

describe('parseDnsName', () => {
  it('punycodes and strips one trailing dot', () => {
    expect(parseDnsName('Example.COM.')).toBe('example.com');
    expect(parseDnsName('münchen.de')).toBe('xn--mnchen-3ya.de');
  });

  it('rejects URLs and single labels', () => {
    expect(() => parseDnsName('https://example.com')).toThrow(/not a URL/);
    expect(() => parseDnsName('localhost')).toThrow(/not a valid domain/);
  });

  it('stays inside ToolInputError for garbage', () => {
    expectRobust(parseDnsName);
  });
});

describe('dnsUrl', () => {
  it('builds a Cloudflare DNS-over-HTTPS query', () => {
    expect(dnsUrl('example.com', 'MX')).toBe('https://cloudflare-dns.com/dns-query?name=example.com&type=MX');
  });
});

describe('parseDoh', () => {
  it('reads the example.com A records returned by Cloudflare', () => {
    expect(parseDoh(EXAMPLE_A)).toEqual({
      status: 'NOERROR',
      answers: [
        { name: 'example.com', type: 'A', ttl: '84', data: '104.20.23.154' },
        { name: 'example.com', type: 'A', ttl: '84', data: '172.66.147.243' },
      ],
    });
  });

  it('names NXDOMAIN and ignores answers without data', () => {
    expect(parseDoh({ Status: 3, Answer: [{ name: 'missing.test', type: 1 }] })).toEqual({
      status: 'NXDOMAIN',
      answers: [],
    });
  });

  it('rejects a body that is not a DNS response', () => {
    expect(() => parseDoh({ ip: '8.8.8.8' })).toThrow(/unexpected response/);
  });
});
