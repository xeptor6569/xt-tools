import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'query-string-json',
  name: 'Query string JSON',
  description: 'Convert a query string to JSON and JSON back to a query string.',
  category: 'web',
  keywords: ['query string', 'json', 'search params', 'url'],
  examples: [{ input: 'a=1&b=2', expect: '{"a":"1","b":"2"}' }],
  added: '2026-10-24',
};

export default meta;
