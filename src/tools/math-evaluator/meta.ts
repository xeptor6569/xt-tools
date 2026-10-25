import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'math-evaluator',
  name: 'Math evaluator',
  description: 'Evaluate arithmetic and common functions without running arbitrary code.',
  category: 'math',
  keywords: ['math', 'calculator', 'expression', 'evaluate'],
  added: '2026-10-24',
  heavy: true,
  examples: [
    { input: '1+2*3', expect: '7' },
    { input: 'sin(90)', expect: '1' },
  ],
};

export default meta;
