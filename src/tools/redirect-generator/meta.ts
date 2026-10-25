import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'redirect-generator',
  name: 'Redirect generator',
  description: 'Generate nginx and Apache redirect rules from a from/to pair.',
  category: 'web',
  keywords: ['redirect', 'nginx', 'htaccess', 'rewrite', '301'],
  tags: ['http', 'url'],
  examples: [{ input: '301 /old /new', expect: 'Redirect 301 /old /new' }],
  added: '2026-10-24',
};

export default meta;
