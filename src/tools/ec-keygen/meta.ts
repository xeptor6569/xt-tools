import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'ec-keygen',
  name: 'EC key generator',
  description: 'Generate an Ed25519 or ECDSA key pair on this device.',
  category: 'crypto',
  keywords: ['ed25519', 'ecdsa', 'p256', 'key', 'elliptic'],
  tags: ['key', 'elliptic'],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
