import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'text-to-binary',
  name: 'Text to binary',
  description: 'Convert text to binary, octal, decimal or hex byte values and back.',
  category: 'converter',
  keywords: ['binary', 'ascii', 'bytes', 'text to binary', 'bits', 'utf-8'],
  examples: [{ input: 'Hi', expect: '01001000 01101001' }],
  added: '2026-10-18',
};

export default meta;
