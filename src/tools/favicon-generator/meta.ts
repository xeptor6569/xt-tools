import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'favicon-generator',
  name: 'Favicon generator',
  description: 'Draw a letter favicon and download it as PNG or ICO.',
  category: 'web',
  keywords: ['favicon', 'ico', 'png', 'icon'],
  tags: ['image', 'seo'],
  examples: [{ input: 'Z', expect: 'Letter favicon: Z' }],
  added: '2026-10-24',
};

export default meta;
