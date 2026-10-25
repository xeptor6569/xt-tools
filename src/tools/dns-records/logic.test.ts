import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { dnsRecords, recipeFromForm, type DnsForm } from './logic.ts';

const form = (patch: Partial<DnsForm>): DnsForm => ({
  kind: 'SPF',
  domain: 'example.com',
  spf: 'mx -all',
  dmarcPolicy: 'reject',
  dmarcRua: '',
  dmarcAdkim: '',
  dmarcAspf: '',
  caaFlags: '0',
  caaTag: 'issue',
  caaValue: 'letsencrypt.org',
  srvService: 'sip',
  srvProto: 'tcp',
  srvPriority: '10',
  srvWeight: '20',
  srvPort: '5060',
  srvTarget: '',
  dkimSelector: 's1',
  dkimKey: '',
  ...patch,
});

describe('dnsRecords', () => {
  it('builds an SPF record from a recipe', () => {
    expect(dnsRecords('SPF example.com mx -all')).toBe('Name: example.com\nValue: v=spf1 mx -all');
    expect(dnsRecords('spf example.com ip4:192.0.2.1 include:_spf.example.net ~all')).toContain(
      'v=spf1 ip4:192.0.2.1 include:_spf.example.net ~all',
    );
  });

  it('builds DMARC, CAA, SRV and a DKIM placeholder', () => {
    expect(dnsRecords('DMARC example.com p=reject rua=mailto:dmarc@example.com')).toBe(
      'Name: _dmarc.example.com\nValue: v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
    );
    expect(dnsRecords('CAA example.com 0 issue letsencrypt.org')).toBe(
      'Name: example.com\nValue: 0 issue "letsencrypt.org"',
    );
    expect(dnsRecords('SRV _sip._tcp.example.com 10 20 5060 sip.example.com')).toBe(
      'Name: _sip._tcp.example.com\nValue: 10 20 5060 sip.example.com.',
    );
    expect(dnsRecords('SRV example.com sip tcp 10 20 5060 sip.example.com')).toContain('_sip._tcp.example.com');
    expect(dnsRecords('DKIM example.com s1 MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A')).toBe(
      'Name: s1._domainkey.example.com\nValue: v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A',
    );
  });

  it('round-trips a form into the same record', () => {
    const recipe = recipeFromForm(form({ kind: 'DMARC', dmarcRua: 'dmarc@example.com', dmarcAdkim: 's' }));
    expect(dnsRecords(recipe)).toContain('v=DMARC1; p=reject; rua=mailto:dmarc@example.com; adkim=s');
    expect(dnsRecords(recipeFromForm(form({ kind: 'SRV' })))).toContain('10 20 5060 sip.example.com.');
    expect(recipeFromForm(form({ kind: 'DKIM', dkimKey: '' }))).toBe('');
  });

  it('rejects an unknown recipe and returns nothing for empty input', () => {
    expect(dnsRecords('')).toBe('');
    expect(dnsRecords('# comment\n')).toBe('');
    expect(() => dnsRecords('hello')).toThrow(ToolInputError);
    expect(() => dnsRecords('SPF example.com')).toThrow(ToolInputError);
    expect(() => dnsRecords('DMARC example.com rua=mailto:a@b.c')).toThrow(ToolInputError);
    expect(() => dnsRecords('DKIM example.com s1 short')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(dnsRecords, { malformed: ['SPF', 'CAA example.com', 'SRV _sip._tcp.example.com 1 2'] });
  });
});
