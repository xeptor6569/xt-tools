import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'password-strength',
  name: 'Password strength',
  description: 'Estimate how guessable a password is, without sending it anywhere.',
  category: 'crypto',
  keywords: ['password', 'strength', 'zxcvbn', 'entropy', 'guesses'],
  examples: [
    { input: 'password', expect: 'score: 0/4' },
    { input: 'correct horse battery staple', expect: 'score: 4/4' },
  ],
  added: '2026-10-24',
  sensitive: true,
  heavy: true,
};

export default meta;
