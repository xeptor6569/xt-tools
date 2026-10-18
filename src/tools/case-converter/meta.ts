import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'case-converter',
  name: 'Case converter',
  description: 'Convert text between camelCase, snake_case, kebab-case, Title Case and more.',
  category: 'converter',
  keywords: [
    'case',
    'camelcase',
    'snake case',
    'kebab case',
    'pascal case',
    'constant case',
    'title case',
    'uppercase',
    'lowercase',
  ],
  examples: [{ input: 'XMLHttpRequest handler', expect: 'xml_http_request_handler' }],
  added: '2026-10-18',
};

export default meta;
