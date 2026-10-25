import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'css-clamp',
  name: 'CSS clamp',
  description: 'Calculate a CSS clamp() for a size between two viewport widths.',
  category: 'design',
  keywords: ['clamp', 'css', 'fluid', 'viewport', 'typography'],
  tags: ['css', 'typography'],
  added: '2026-10-24',
  examples: [{ input: 'min 16 max 24 from 320 to 1280', expect: 'clamp(' }],
};

export default meta;
