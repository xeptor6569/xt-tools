import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'pdf-tools',
  name: 'PDF tools',
  description: 'Merge, split, extract, rotate and compress PDF files locally in your browser.',
  category: 'documents',
  keywords: ['pdf', 'merge', 'split', 'rotate', 'compress', 'pages', 'extract', 'document'],
  tags: ['pdf', 'merge', 'split'],
  added: '2026-11-06',
  heavy: true,
  examples: [
    {
      input: 'pages: 8\nselect: 1-3, 6, 8-7\nrotate: 90',
      expect: 'selected 6 of 8 page(s): 1, 2, 3, 6, 8, 7, rotate 90 deg',
    },
  ],
};

export default meta;
