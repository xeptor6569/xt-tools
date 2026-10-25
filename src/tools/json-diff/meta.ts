import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'json-diff',
  name: 'JSON diff',
  description: 'Compare two JSON values and show the added, removed and changed paths.',
  category: 'web',
  keywords: ['json', 'diff', 'compare', 'patch'],
  tags: ['json', 'diff'],
  examples: [{ input: '{"a":1,"b":2}\n---\n{"a":1,"c":3}', expect: 'removed /b' }],
  added: '2026-10-24',
};

export default meta;
