import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'token-generator',
  name: 'Random bytes',
  description: 'Generate random bytes locally, like openssl rand, as hex, base64 or a raw file.',
  category: 'crypto',
  keywords: ['random', 'bytes', 'openssl', 'rand', 'hex', 'base64', 'binary', 'token'],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
