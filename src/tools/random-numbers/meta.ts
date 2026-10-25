import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'random-numbers',
  name: 'Random numbers',
  description: 'Draw seeded numbers, dice and a shuffled list.',
  category: 'math',
  keywords: ['random', 'dice', 'shuffle', 'seed', 'prng'],
  added: '2026-10-24',
  examples: [{ input: '1', expect: '68 34 88 22 4' }],
};

export default meta;
