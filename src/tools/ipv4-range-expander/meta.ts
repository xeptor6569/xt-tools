import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'ipv4-range-expander',
  name: 'IPv4 range expander',
  description: 'Expand an IPv4 start and end address into the covering CIDR blocks.',
  category: 'network',
  keywords: ['ipv4', 'range', 'cidr', 'expand', 'subnet'],
  examples: [
    { input: '192.168.1.0 192.168.1.255', expect: '192.168.1.0/24' },
    { input: '10.0.0.0-10.0.1.255', expect: '10.0.0.0/23' },
  ],
  added: '2026-10-24',
};

export default meta;
