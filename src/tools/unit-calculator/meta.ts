import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'unit-calculator',
  name: 'Unit calculator',
  description: 'Evaluate an expression that mixes compatible units.',
  category: 'math',
  keywords: ['unit', 'calculator', 'convert', 'expression'],
  added: '2026-10-24',
  heavy: true,
  examples: [
    { input: '5 km + 20 m', expect: '5.02 km' },
    { input: '10 F to C', expect: '-12.2222222222' },
  ],
};

export default meta;
