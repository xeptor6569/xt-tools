import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'eta-calculator',
  name: 'ETA calculator',
  description: 'Estimate remaining time from progress and elapsed time.',
  category: 'math',
  keywords: ['eta', 'time', 'progress', 'estimate'],
  tags: ['time', 'math'],
  added: '2026-10-24',
  examples: [
    { input: '50% in 10 min', expect: '10 min' },
    { input: 'done 25 of 100 in 600 seconds', expect: '1800 seconds' },
  ],
};

export default meta;
