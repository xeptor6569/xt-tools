import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'hue-variants',
  name: 'Hue variants',
  description: 'Shift an image through several hues and download the set.',
  category: 'images-media',
  keywords: ['hue', 'color', 'variants', 'image'],
  tags: ['color', 'image'],
  added: '2026-10-24',
  examples: [{ input: '#ff0000', expect: '#ff8000' }],
};

export default meta;
