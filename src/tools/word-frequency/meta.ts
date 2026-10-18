import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'word-frequency',
  name: 'Word frequency counter',
  description: 'Count how often each word appears in a text.',
  category: 'text',
  keywords: ['word', 'frequency', 'count', 'occurrences', 'keyword density'],
  examples: [{ input: 'The cat and the hat. The cat sat.', expect: '37.50%' }],
  added: '2026-10-18',
};

export default meta;
