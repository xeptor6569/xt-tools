import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'json-query',
  name: 'JSONPath & jq playground',
  description: 'Query and transform JSON documents with JSONPath or jq (WebAssembly).',
  category: 'development',
  group: 'utilities',
  keywords: ['json', 'jsonpath', 'jq', 'query', 'filter', 'playground', 'select', 'json pointer', 'json path', 'wasm'],
  tags: ['json', 'query', 'jq'],
  examples: [{ input: '{"a":{"b":42}}', expect: '42' }],
  added: '2026-10-24',
  heavy: true,
};

export default meta;
