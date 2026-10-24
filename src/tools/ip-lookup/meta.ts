import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'ip-lookup',
  name: 'IP lookup',
  description: "Show this connection's public IP address, or look up another IP and its approximate location.",
  category: 'network',
  keywords: ['ip', 'address', 'geolocation', 'my ip', 'public ip', 'location'],
  added: '2026-10-24',
  network: { hosts: ['https://api.ipify.org', 'https://api64.ipify.org', 'https://ipwho.is'] },
};

export default meta;
