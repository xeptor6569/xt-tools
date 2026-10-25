import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'sprite-splitter',
  name: 'Sprite splitter',
  description: 'Split a sprite sheet into equal frames and download them.',
  category: 'images-media',
  keywords: ['sprite', 'sheet', 'split', 'frames'],
  tags: ['image', 'css'],
  added: '2026-10-24',
  examples: [{ input: '2 2 100 80', expect: '0,0 50×40' }],
};

export default meta;
