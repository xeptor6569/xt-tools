import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'base-converter',
  name: 'Integer base converter',
  description: 'Convert whole numbers of any size between binary, octal, decimal, hex and other bases.',
  category: 'converter',
  group: 'numbers',
  keywords: ['base', 'binary', 'octal', 'decimal', 'hexadecimal', 'radix', 'number'],
  tags: ['number', 'encoding'],
  examples: [{ input: '0xDEADBEEF', expect: '3735928559' }],
  added: '2026-10-18',
};

export default meta;
