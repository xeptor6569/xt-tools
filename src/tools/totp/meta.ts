import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'totp',
  name: 'TOTP',
  description: 'Generate and check a TOTP code from a Base32 secret.',
  category: 'crypto',
  keywords: ['totp', 'otp', '2fa', 'authenticator', 'rfc6238'],
  tags: ['token', 'otp'],
  examples: [
    {
      input: 'secret: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ\ndigits: 8\ntime: 59',
      expect: '94287082',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
