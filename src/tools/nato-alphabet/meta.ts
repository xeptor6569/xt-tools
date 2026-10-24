import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'nato-alphabet',
  name: 'NATO alphabet',
  description: 'Spell text out with the NATO phonetic alphabet, or turn code words back into letters.',
  category: 'converter',
  group: 'signals',
  keywords: ['nato', 'phonetic', 'alphabet', 'spelling', 'alfa bravo charlie', 'radio'],
  examples: [
    { input: 'XT 42', expect: 'X-ray Tango / Four Two' },
    { input: 'Sierra Oscar Sierra', expect: 'SOS' },
  ],
  added: '2026-10-18',
};

export default meta;
