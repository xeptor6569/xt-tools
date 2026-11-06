import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'list-converter',
  name: 'List converter',
  description: 'Sort, dedupe, wrap, join and split lists, including links pasted together.',
  category: 'converter',
  group: 'formats',
  keywords: ['list', 'lines', 'join', 'split', 'sort', 'comma separated', 'quote', 'url', 'links'],
  tags: ['text', 'list'],
  examples: [
    { input: 'apple\nbanana\ncherry', expect: 'apple, banana, cherry' },
    {
      input: 'https://example.com/ahttps://example.com/b',
      expect: 'https://example.com/a, https://example.com/b',
    },
  ],
  added: '2026-10-18',
};

export default meta;
