import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'shamir',
  name: 'Shamir sharing',
  description: 'Split a secret into shares and recover it from enough of them.',
  category: 'crypto',
  keywords: ['shamir', 'secret sharing', 'split', 'recover', 'threshold'],
  tags: ['secret', 'key'],
  examples: [
    {
      input: 'mode: join\n1: 6869\n2: 6869',
      expect: 'hi',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
