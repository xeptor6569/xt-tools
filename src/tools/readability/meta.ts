import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'readability',
  name: 'Readability score',
  description: 'Score English text with Flesch reading ease, Flesch–Kincaid grade and other readability tests.',
  category: 'text',
  group: 'analyze',
  keywords: ['readability', 'flesch', 'kincaid', 'grade level', 'reading ease'],
  tags: ['text', 'writing'],
  examples: [{ input: 'The cat sat on the mat. The dog ran to the park.', expect: 'Very easy' }],
  added: '2026-10-18',
};

export default meta;
