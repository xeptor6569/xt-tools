import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'gradient-generator',
  name: 'Gradient generator',
  description: 'Build a CSS linear or radial gradient and copy the declaration.',
  category: 'design',
  keywords: ['gradient', 'css', 'linear', 'radial'],
  added: '2026-10-24',
  examples: [{ input: '90 #000000 #ffffff', expect: 'linear-gradient' }],
};

export default meta;
