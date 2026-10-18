import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'table-converter',
  name: 'Table converter',
  description: 'Convert tables between CSV, TSV, JSON, Markdown and HTML.',
  category: 'converter',
  keywords: ['table', 'csv', 'tsv', 'markdown table', 'html table', 'markdown table generator', 'csv to markdown'],
  examples: [{ input: 'Name,Role\nAda,Engineer', expect: '| Ada  | Engineer |' }],
  added: '2026-10-18',
};

export default meta;
