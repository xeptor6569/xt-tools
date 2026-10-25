import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'ssh-keygen',
  name: 'SSH key generator',
  description: 'Generate an SSH key and show its fingerprint.',
  category: 'crypto',
  keywords: ['ssh', 'ed25519', 'rsa', 'fingerprint', 'openssh'],
  tags: ['ssh', 'key'],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
