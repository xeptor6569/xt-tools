import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'palette-extractor',
  name: 'Palette extractor',
  description: 'Extract a small color palette from an image.',
  category: 'images-media',
  keywords: ['palette', 'color', 'image', 'extract'],
  tags: ['color', 'image'],
  added: '2026-10-24',
  examples: [{ input: '2 ff0000 0000ff', expect: '#ff0000' }],
};

export default meta;
