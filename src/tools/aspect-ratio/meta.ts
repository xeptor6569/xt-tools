import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'aspect-ratio',
  name: 'Aspect ratio',
  description: 'Calculate a missing width or height from an aspect ratio.',
  category: 'images-media',
  keywords: ['aspect', 'ratio', 'width', 'height', '16:9'],
  tags: ['image', 'css'],
  added: '2026-10-24',
  examples: [
    { input: '1920 1080', expect: '16:9' },
    { input: '16:9 width 1280', expect: '720' },
  ],
};

export default meta;
