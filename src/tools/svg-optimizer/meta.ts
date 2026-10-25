import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'svg-optimizer',
  name: 'SVG optimizer',
  description: 'Clean an SVG and preview the sanitized result.',
  category: 'images-media',
  keywords: ['svg', 'optimize', 'minify', 'svgo'],
  tags: ['svg', 'image'],
  added: '2026-10-24',
  heavy: true,
  examples: [
    {
      input:
        '<?xml version="1.0"?><!-- x --><svg xmlns="http://www.w3.org/2000/svg" inkscape:version="1"><rect width="10" height="10"/></svg>',
      expect: 'width="10"',
    },
  ],
};

export default meta;
