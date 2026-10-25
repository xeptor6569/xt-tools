import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'number-theory',
  name: 'Number theory',
  description: 'Factor a number and compute primes, GCD and LCM.',
  category: 'math',
  keywords: ['prime', 'factor', 'gcd', 'lcm', 'number theory'],
  added: '2026-10-24',
  examples: [
    { input: 'factor 84', expect: '2^2 × 3 × 7' },
    { input: 'gcd 12 18', expect: '6' },
    { input: 'lcm 4 6', expect: '12' },
    { input: 'prime 97', expect: '97 is prime' },
  ],
};

export default meta;
