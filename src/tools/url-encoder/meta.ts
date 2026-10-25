import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'url-encoder',
  name: 'URL encoder',
  description: 'Encode and decode URL components and full URLs.',
  category: 'web',
  keywords: ['url', 'encode', 'decode', 'percent', 'uri'],
  tags: ['url', 'encoding'],
  examples: [{ input: 'a b', expect: 'a%20b' }],
  added: '2026-10-24',
};

export default meta;
