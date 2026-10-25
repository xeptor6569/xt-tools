import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'social-preview',
  name: 'Social preview',
  description: 'Preview a sanitized title, description and image as a social card.',
  category: 'web',
  keywords: ['social', 'preview', 'og', 'card', 'seo'],
  examples: [{ input: 'Hello | A short description', expect: 'Hello' }],
  added: '2026-10-24',
};

export default meta;
