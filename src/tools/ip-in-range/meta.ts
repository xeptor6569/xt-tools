import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'ip-in-range',
  name: 'IP in range',
  description: 'Check whether an IP address falls inside a list of ranges.',
  category: 'network',
  keywords: ['ip', 'cidr', 'range', 'contains', 'match'],
  tags: ['ip', 'network'],
  examples: [
    {
      input: '192.168.1.50\n192.168.1.0/24\n10.0.0.0/8\n',
      expect: '192.168.1.0/24: yes',
    },
    { input: '2001:db8::1\n2001:db8::/32\n', expect: '2001:db8::/32: yes' },
  ],
  added: '2026-10-24',
};

export default meta;
