import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'matrix-calculator',
  name: 'Matrix calculator',
  description: 'Add, multiply, transpose and invert small numeric matrices.',
  category: 'math',
  keywords: ['matrix', 'determinant', 'inverse', 'multiply'],
  tags: ['math', 'calculator'],
  added: '2026-10-24',
  examples: [
    { input: 'det\n1 2\n3 4', expect: '-2' },
    { input: 'add\n1 2\n3 4\n\n5 6\n7 8', expect: '6 8' },
  ],
};

export default meta;
