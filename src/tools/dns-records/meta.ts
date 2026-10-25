import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'dns-records',
  name: 'DNS record builder',
  description: 'Build SPF, DMARC, DKIM, CAA and SRV records from a form.',
  category: 'network',
  keywords: ['dns', 'spf', 'dmarc', 'dkim', 'caa', 'srv'],
  tags: ['dns', 'email'],
  examples: [
    { input: 'SPF example.com mx -all', expect: 'v=spf1 mx -all' },
    {
      input: 'DMARC example.com p=reject rua=mailto:dmarc@example.com',
      expect: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
    },
    { input: 'CAA example.com 0 issue letsencrypt.org', expect: '0 issue "letsencrypt.org"' },
    { input: 'SRV _sip._tcp.example.com 10 20 5060 sip.example.com', expect: '10 20 5060 sip.example.com.' },
    { input: 'DKIM example.com s1 MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A', expect: 's1._domainkey.example.com' },
  ],
  added: '2026-10-24',
};

export default meta;
