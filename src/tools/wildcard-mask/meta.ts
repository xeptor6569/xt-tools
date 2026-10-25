import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'wildcard-mask',
  name: 'Wildcard mask',
  description: 'Convert between a subnet mask, a prefix length and a wildcard mask.',
  category: 'network',
  keywords: ['wildcard', 'netmask', 'cidr', 'acl', 'inverse'],
  tags: ['ip', 'network'],
  examples: [
    { input: '/24', expect: '0.0.0.255' },
    { input: '255.255.255.0', expect: '/24' },
    { input: '0.0.0.255', expect: '255.255.255.0' },
  ],
  added: '2026-10-24',
};

export default meta;
