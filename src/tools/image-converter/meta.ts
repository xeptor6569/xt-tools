import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'image-converter',
  name: 'Image converter',
  description: 'Resize, crop, compress and convert an image in the browser.',
  category: 'images-media',
  keywords: ['image', 'resize', 'crop', 'compress', 'convert', 'png', 'jpeg'],
  tags: ['image', 'convert'],
  added: '2026-10-24',
  examples: [{ input: '1600 900 800 jpeg 0.8', expect: '800×450' }],
};

export default meta;
