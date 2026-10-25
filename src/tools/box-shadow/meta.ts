import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'box-shadow',
  name: 'Box shadow',
  description: 'Build a CSS box-shadow and preview it on a sample box.',
  category: 'design',
  keywords: ['box-shadow', 'css', 'shadow', 'preview'],
  added: '2026-10-24',
  examples: [{ input: '4 8 24 0 #000000', expect: 'box-shadow:' }],
};

export default meta;
