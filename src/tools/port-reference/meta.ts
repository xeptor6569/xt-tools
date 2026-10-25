import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'port-reference',
  name: 'Port reference',
  description: 'Look up common TCP and UDP port numbers.',
  category: 'network',
  keywords: ['port', 'tcp', 'udp', 'iana', 'service'],
  tags: ['network', 'reference'],
  examples: [
    { input: '443', expect: 'HTTPS' },
    { input: 'ssh', expect: '22' },
  ],
  added: '2026-10-24',
};

export default meta;
