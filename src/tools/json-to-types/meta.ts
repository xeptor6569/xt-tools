import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'json-to-types',
  name: 'JSON to types',
  description: 'Generate TypeScript, Go, Rust or Python type definitions from a sample JSON document.',
  category: 'development',
  keywords: [
    'json',
    'typescript',
    'go',
    'rust',
    'python',
    'types',
    'interface',
    'struct',
    'json to typescript',
    'json to go',
    'serde',
    'dataclass',
    'typeddict',
  ],
  examples: [{ input: '{"id":1,"name":"Ada"}', expect: 'interface Root' }],
  added: '2026-10-24',
};

export default meta;
