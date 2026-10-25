import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'hmac-generator',
  name: 'HMAC generator',
  description: 'Compute an HMAC over text with a secret key.',
  category: 'crypto',
  keywords: ['hmac', 'mac', 'sha256', 'authentication', 'key'],
  examples: [
    {
      input: 'key: key\nThe quick brown fox jumps over the lazy dog',
      expect: 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    },
    {
      input: 'algo: sha256\nkey-hex: 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b\nHi There',
      expect: 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
