import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'whois-lookup',
  name: 'Whois lookup',
  description: 'Look up .com, .net, .org and ARIN registration data for a domain name or IP address.',
  category: 'network',
  keywords: ['whois', 'rdap', 'domain', 'registrar', 'arin'],
  added: '2026-10-24',
  network: { hosts: ['https://rdap.verisign.com', 'https://rdap.publicinterestregistry.org', 'https://rdap.arin.net'] },
};

export default meta;
