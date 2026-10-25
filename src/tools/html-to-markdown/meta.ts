import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'html-to-markdown',
  name: 'HTML to Markdown',
  description: 'Convert HTML into clean Markdown.',
  category: 'converter',
  group: 'formats',
  keywords: ['html', 'markdown', 'convert', 'turndown'],
  tags: ['html', 'markdown'],
  examples: [{ input: '<h2>Notes</h2><p>Some <strong>bold</strong> text.</p>', expect: '## Notes' }],
  added: '2026-10-18',
};

export default meta;
