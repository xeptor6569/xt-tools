import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'contrast-checker',
  name: 'Contrast checker',
  description: 'Check a foreground and background pair against WCAG contrast.',
  category: 'design',
  keywords: ['contrast', 'wcag', 'color', 'aa', 'aaa'],
  tags: ['color', 'css'],
  added: '2026-10-24',
  examples: [{ input: '#000000 #ffffff', expect: '21' }],
};

export default meta;
