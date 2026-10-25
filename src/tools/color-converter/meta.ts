import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'color-converter',
  name: 'Color converter',
  description: 'Convert any CSS color between hex, RGB, HSL, HWB, Lab, LCH and OKLCH.',
  category: 'converter',
  group: 'units',
  keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'hwb', 'lab', 'lch', 'oklch', 'oklab', 'css'],
  tags: ['color', 'css'],
  examples: [
    { input: 'rebeccapurple', expect: '#663399' },
    { input: 'oklch(0.7 0.15 150)', expect: 'rgb(' },
  ],
  added: '2026-10-18',
};

export default meta;
