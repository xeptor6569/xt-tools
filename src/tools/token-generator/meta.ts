import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'token-generator',
  name: 'Token generator',
  description: 'Generate cryptographically random tokens as hex or base64.',
  category: 'crypto',
  keywords: ['token', 'secret', 'random', 'hex', 'base64', 'api key'],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
