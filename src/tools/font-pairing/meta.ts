import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'font-pairing',
  name: 'Font pairing',
  description: 'Preview a heading and body font from local and system fonts.',
  category: 'design',
  keywords: ['font', 'pairing', 'typography', 'local'],
  added: '2026-10-24',
  requires: ['local-fonts'],
  examples: [{ input: 'Georgia | Palatino', expect: 'Georgia' }],
};

export default meta;
