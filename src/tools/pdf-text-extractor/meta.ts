import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'pdf-text-extractor',
  name: 'PDF text extractor',
  description: 'Extract the text layer from a PDF, one page at a time, in your browser.',
  category: 'documents',
  keywords: ['pdf', 'text', 'extract', 'copy', 'pages', 'document'],
  tags: ['pdf', 'text', 'extract'],
  added: '2026-11-19',
  sensitive: true,
  heavy: true,
  examples: [
    { input: '1-2, 4', expect: 'Will read pages 1, 2, 4.' },
    { input: 'odd', expect: 'Will read the odd pages.' },
  ],
};

export default meta;
