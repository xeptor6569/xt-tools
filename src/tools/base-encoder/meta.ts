import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'base-encoder',
  name: 'Base encoder',
  description: 'Encode and decode text as Base64, Base64URL, Base32, Base58, Ascii85 or hex.',
  category: 'converter',
  keywords: ['base64', 'base64url', 'base32', 'base58', 'base85', 'ascii85', 'hex', 'encode', 'decode'],
  examples: [{ input: 'Hello, World!', expect: 'SGVsbG8sIFdvcmxkIQ==' }],
  added: '2026-10-18',
};

export default meta;
