import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'data-format-converter',
  name: 'Data format converter',
  description: 'Convert between JSON, YAML, TOML, XML, CSV, .env, INI and Java properties.',
  category: 'converter',
  group: 'formats',
  keywords: [
    'json',
    'yaml',
    'toml',
    'xml',
    'csv',
    'env',
    'ini',
    'properties',
    'json to yaml',
    'yaml to json',
    'json to csv',
  ],
  examples: [{ input: '{"name":"xt-tools","tags":["privacy","offline"]}', expect: 'name: xt-tools' }],
  added: '2026-10-18',
};

export default meta;
