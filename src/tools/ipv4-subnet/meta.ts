import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'ipv4-subnet',
  name: 'IPv4 subnet calculator',
  description: 'Work out the network, broadcast, host range and mask of an IPv4 subnet.',
  category: 'network',
  keywords: ['ipv4', 'subnet', 'cidr', 'netmask', 'wildcard', 'broadcast', 'network', 'ip calculator'],
  tags: ['ip', 'network'],
  examples: [
    { input: '192.168.1.10/24', expect: '192.168.1.255' },
    { input: '10.20.30.40 255.255.240.0', expect: '10.20.16.0/20' },
  ],
  added: '2026-10-18',
};

export default meta;
