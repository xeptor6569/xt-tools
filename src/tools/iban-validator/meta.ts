import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'iban-validator',
  name: 'IBAN validator',
  description: 'Check an IBAN checksum and format it in groups.',
  category: 'data',
  keywords: ['iban', 'bank', 'checksum', 'validate'],
  added: '2026-10-24',
  examples: [{ input: 'GB82WEST12345698765432', expect: 'GB82 WEST' }],
};

export default meta;
