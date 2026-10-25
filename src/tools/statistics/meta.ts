import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'statistics',
  name: 'Statistics',
  description: 'Summarize a list of numbers with mean, median, spread and quartiles.',
  category: 'math',
  keywords: ['statistics', 'mean', 'median', 'stdev', 'quartile'],
  added: '2026-10-24',
  examples: [{ input: '1, 2, 3, 4, 5', expect: 'Mean: 3' }],
};

export default meta;
