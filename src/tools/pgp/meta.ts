import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'pgp',
  name: 'PGP tool',
  description: 'Encrypt, decrypt, sign and verify OpenPGP messages, or generate a key pair.',
  category: 'crypto',
  keywords: ['pgp', 'openpgp', 'gpg', 'encrypt', 'decrypt', 'sign', 'verify', 'armored', 'key'],
  tags: ['pgp', 'encryption', 'signature'],
  added: '2026-11-06',
  sensitive: true,
  heavy: true,
  examples: [
    {
      input: [
        'passphrase: correct-horse',
        '-----BEGIN PGP MESSAGE-----',
        '',
        'wy4ECQMIyEWsXbueNK/gLUNiHu/TyuHpjRVjxvygTd5QTmiPBptZ0MD7VWM1',
        'pXAi0j4B2aKrCQ4Zt8IRkUjxbBSln6eSPscq6qKPqxR9CO39i5IbIJ3gWMbe',
        'yfR/A0CU5TbGdxxkzBLtEBPx72Bjhw==',
        '=4BnO',
        '-----END PGP MESSAGE-----',
      ].join('\n'),
      expect: 'hello openpgp',
    },
  ],
};

export default meta;
