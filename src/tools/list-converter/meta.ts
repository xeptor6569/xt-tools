import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'list-converter',
  name: 'List converter',
  description: 'Sort, dedupe, wrap, join and split lists of items.',
  category: 'converter',
  group: 'formats',
  keywords: ['list', 'lines', 'join', 'split', 'sort', 'comma separated', 'quote'],
  examples: [{ input: 'apple\nbanana\ncherry', expect: 'apple, banana, cherry' }],
  added: '2026-10-18',
};

export default meta;
