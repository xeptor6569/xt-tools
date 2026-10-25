import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'html-entities',
  name: 'HTML entities',
  description: 'Escape and unescape HTML entities in text.',
  category: 'web',
  keywords: ['html', 'entities', 'escape', 'unescape', 'amp'],
  tags: ['html', 'encoding'],
  examples: [{ input: 'a<b>&', expect: 'a&lt;b&gt;&amp;' }],
  added: '2026-10-24',
};

export default meta;
