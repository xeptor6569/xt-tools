import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'ipv4-converter',
  name: 'IPv4 converter',
  description: 'Convert an IPv4 address between dotted decimal, integer, hex and binary.',
  category: 'network',
  keywords: ['ipv4', 'address', 'integer', 'hex', 'binary', 'convert'],
  tags: ['ip', 'network'],
  examples: [
    { input: '192.168.1.1', expect: '3232235777' },
    { input: '3232235777', expect: '192.168.1.1' },
    { input: '0xC0A80101', expect: '192.168.1.1' },
  ],
  added: '2026-10-24',
};

export default meta;
