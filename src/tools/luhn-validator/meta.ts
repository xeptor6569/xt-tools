import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'luhn-validator',
  name: 'Luhn validator',
  description: 'Check a number with the Luhn algorithm, for test numbers only.',
  category: 'data',
  keywords: ['luhn', 'credit card', 'checksum', 'test number'],
  tags: ['checksum', 'bank'],
  added: '2026-10-24',
  sensitive: true,
  examples: [{ input: '4242424242424242', expect: 'valid' }],
};

export default meta;
