import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'rsa-keygen',
  name: 'RSA key generator',
  description: 'Generate an RSA key pair and export it as PEM.',
  category: 'crypto',
  keywords: ['rsa', 'key', 'pem', 'pkcs8', 'spki'],
  tags: ['key', 'rsa'],
  added: '2026-10-24',
  sensitive: true,
  requires: ['webcrypto'],
};

export default meta;
