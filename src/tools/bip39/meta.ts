import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'bip39',
  name: 'BIP39 mnemonic',
  description: 'Create or recover a BIP39 mnemonic and its seed.',
  category: 'crypto',
  keywords: ['bip39', 'mnemonic', 'seed', 'wallet', 'passphrase'],
  examples: [
    {
      input: 'mode: mnemonic\nentropy-hex: 00000000000000000000000000000000',
      expect: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    },
    {
      input:
        'passphrase: TREZOR\nabandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      expect: 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e5349553',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
