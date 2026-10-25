import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'text-stats',
  name: 'Text statistics',
  description: 'Count characters, words, sentences, lines and bytes, and estimate reading time.',
  category: 'text',
  group: 'analyze',
  keywords: ['count', 'characters', 'words', 'length', 'reading time', 'statistics'],
  tags: ['text', 'count'],
  examples: [{ input: 'Hello world. How are you today?', expect: 'Sentences' }],
  added: '2026-10-18',
};

export default meta;
