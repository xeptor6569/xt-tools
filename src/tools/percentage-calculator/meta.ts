import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'percentage-calculator',
  name: 'Percentage calculator',
  description: 'Calculate a percentage of a value, a change, and a reverse percentage.',
  category: 'math',
  keywords: ['percentage', 'percent', 'ratio', 'change'],
  tags: ['math', 'calculator'],
  added: '2026-10-24',
  examples: [
    { input: '20% of 80', expect: '16' },
    { input: '20 is what % of 80', expect: '25%' },
    { input: 'from 80 to 100', expect: '25%' },
  ],
};

export default meta;
