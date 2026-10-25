import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'html-editor',
  name: 'HTML editor',
  description: 'Edit HTML and preview the sanitized result in a sandbox.',
  category: 'web',
  keywords: ['html', 'editor', 'preview', 'wysiwyg', 'sanitize'],
  tags: ['html', 'editor'],
  examples: [{ input: '<p>Hello</p>', expect: 'Hello' }],
  added: '2026-10-24',
  heavy: true,
};

export default meta;
