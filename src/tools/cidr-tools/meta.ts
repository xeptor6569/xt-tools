import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'cidr-tools',
  name: 'CIDR tools',
  description: 'Aggregate CIDR prefixes and report which ones overlap.',
  category: 'network',
  keywords: ['cidr', 'aggregate', 'overlap', 'supernet', 'prefix'],
  examples: [
    { input: '10.0.0.0/24\n10.0.1.0/24\n', expect: '10.0.0.0/23' },
    { input: '10.0.0.0/8\n10.1.2.0/24\n', expect: '10.0.0.0/8 contains 10.1.2.0/24' },
  ],
  added: '2026-10-24',
};

export default meta;
