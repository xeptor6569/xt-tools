import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'roman-numerals',
  name: 'Roman numeral converter',
  description: 'Convert numbers to Roman numerals and back.',
  category: 'converter',
  group: 'numbers',
  keywords: ['roman', 'numerals', 'number', 'latin'],
  examples: [{ input: '1994\nMMXXVI', expect: 'MCMXCIV\n2026' }],
  added: '2026-10-18',
};

export default meta;
