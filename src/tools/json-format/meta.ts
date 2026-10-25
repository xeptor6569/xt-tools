import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'json-format',
  name: 'JSON formatter',
  description: 'Prettify, minify and validate JSON, with optional key sorting.',
  category: 'development',
  group: 'formatters',
  keywords: ['json', 'prettify', 'beautify', 'minify', 'format', 'validate', 'pretty print'],
  tags: ['json', 'format'],
  examples: [{ input: '{"name":"xt-tools","tags":["privacy","offline"]}', expect: '"tags": [' }],
  added: '2026-10-18',
};

export default meta;
