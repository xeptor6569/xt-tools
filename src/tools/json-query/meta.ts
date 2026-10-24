import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'json-query',
  name: 'JSONPath playground',
  description: 'Query JSON documents with JSONPath expressions and see each matching value and its path.',
  category: 'development',
  group: 'utilities',
  keywords: ['json', 'jsonpath', 'query', 'filter', 'playground', 'select', 'json pointer', 'json path'],
  examples: [{ input: '{"a":{"b":42}}', expect: '42' }],
  added: '2026-10-24',
};

export default meta;
