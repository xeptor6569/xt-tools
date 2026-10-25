import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'svg-placeholder',
  name: 'SVG placeholder',
  description: 'Generate a sized SVG placeholder with a label.',
  category: 'images-media',
  keywords: ['svg', 'placeholder', 'image', 'dummy'],
  added: '2026-10-24',
  examples: [{ input: '640 480 Hello', expect: 'width="640"' }],
};

export default meta;
