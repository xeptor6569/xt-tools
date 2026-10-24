import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'text-cleanup',
  name: 'Text cleanup',
  description: 'Remove duplicate lines, trailing spaces, blank lines and other clutter from text.',
  category: 'text',
  group: 'transform',
  keywords: ['dedupe', 'duplicate lines', 'trim', 'blank lines', 'whitespace', 'clean', 'remove'],
  examples: [{ input: '  first   line  \n\n\n\nsecond line   ', expect: 'first line\n\nsecond line' }],
  added: '2026-10-18',
};

export default meta;
