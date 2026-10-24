import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'string-obfuscator',
  name: 'String obfuscator',
  description: 'Mask part of a string, such as an API key or email, keeping only the first and last characters.',
  category: 'text',
  group: 'transform',
  keywords: ['obfuscate', 'mask', 'redact', 'hide', 'secret', 'censor'],
  sensitive: true,
  added: '2026-10-18',
};

export default meta;
