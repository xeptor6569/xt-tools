import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'graph-plotter',
  name: 'Graph plotter',
  description: 'Plot a function of x on a canvas from a safe expression.',
  category: 'math',
  keywords: ['graph', 'plot', 'function', 'canvas'],
  tags: ['math', 'graph'],
  added: '2026-10-24',
  examples: [{ input: 'x', expect: '0 → 0' }],
};

export default meta;
