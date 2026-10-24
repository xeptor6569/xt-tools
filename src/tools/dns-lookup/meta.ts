import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'dns-lookup',
  name: 'DNS lookup',
  description: 'Look up DNS records for a hostname through Cloudflare DNS-over-HTTPS.',
  category: 'network',
  keywords: ['dns', 'lookup', 'dig', 'doh', 'mx', 'nameserver', 'txt'],
  added: '2026-10-24',
  network: { hosts: ['https://cloudflare-dns.com'] },
};

export default meta;
