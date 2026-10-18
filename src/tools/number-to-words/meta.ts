import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'number-to-words',
  name: 'Number to words',
  description: 'Spell out numbers in English words, including ordinals and cheque-style amounts.',
  category: 'converter',
  keywords: ['number', 'words', 'spell', 'ordinal', 'cheque', 'check'],
  examples: [{ input: '1234.56', expect: 'One thousand two hundred thirty-four and 56/100' }],
  added: '2026-10-18',
};

export default meta;
