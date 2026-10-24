import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'json-schema',
  name: 'JSON Schema validator',
  description:
    'Validate JSON against a JSON Schema (drafts 4 to 2020-12), or generate a starting schema from sample JSON.',
  category: 'development',
  keywords: [
    'json',
    'schema',
    'validate',
    'validator',
    'generate',
    'draft 2020-12',
    'draft 7',
    'json schema generator',
    'infer schema',
  ],
  examples: [{ input: '{"name":"Ada","age":36}', expect: '"type": "object"' }],
  added: '2026-10-24',
};

export default meta;
