import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'password-generator',
  name: 'Password generator',
  description: 'Generate a random password or an EFF Diceware passphrase in this browser.',
  category: 'crypto',
  keywords: ['password', 'passphrase', 'diceware', 'generator', 'secret'],
  added: '2026-10-25',
  sensitive: true,
  heavy: true,
};

export default meta;
