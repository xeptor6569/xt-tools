import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'bcrypt',
  name: 'Bcrypt',
  description: 'Hash a password with bcrypt and check a hash against a password.',
  category: 'crypto',
  keywords: ['bcrypt', 'password', 'hash', 'compare', 'kdf'],
  tags: ['password', 'hash'],
  examples: [
    {
      input: 'mode: compare\nhash: $2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i\nabc',
      expect: 'match',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
