import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'csv-editor',
  name: 'CSV editor',
  description: 'View and edit a CSV table, then export CSV or JSON.',
  category: 'data',
  keywords: ['csv', 'table', 'editor', 'tsv', 'json'],
  added: '2026-10-24',
  examples: [{ input: 'a,b\n1,2', expect: 'a,b' }],
};

export default meta;
