import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'ipv6-subnet',
  name: 'IPv6 subnet',
  description: 'Expand, compress and split an IPv6 address or prefix.',
  category: 'network',
  keywords: ['ipv6', 'subnet', 'cidr', 'compress', 'expand'],
  examples: [
    { input: '2001:0db8:0000:0000:0000:0000:0000:0001', expect: '2001:db8::1' },
    { input: '2001:db8::1/64', expect: '2001:db8::ffff:ffff:ffff:ffff' },
  ],
  added: '2026-10-24',
};

export default meta;
