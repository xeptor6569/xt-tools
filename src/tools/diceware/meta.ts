import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'diceware',
  name: 'Diceware',
  description: 'Generate a Diceware passphrase from the EFF wordlist.',
  category: 'crypto',
  keywords: ['diceware', 'passphrase', 'eff', 'words', 'password'],
  added: '2026-10-24',
  sensitive: true,
  heavy: true,
};

export default meta;
