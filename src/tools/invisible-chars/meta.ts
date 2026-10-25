import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'invisible-chars',
  name: 'Invisible character detector',
  description: 'Find invisible, zero-width, bidirectional and look-alike characters hidden in text.',
  category: 'text',
  group: 'analyze',
  keywords: ['invisible', 'zero width', 'homoglyph', 'bidi', 'unicode', 'hidden characters', 'trojan source'],
  tags: ['unicode', 'text'],
  examples: [{ input: 'pаypal.com\u200b', expect: '2 suspicious characters found.' }],
  added: '2026-10-18',
};

export default meta;
