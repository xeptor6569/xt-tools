import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'iban-validator',
  name: 'IBAN validator',
  description: 'Validate an IBAN and show its country, BBAN and Swiss QR-IBAN status.',
  category: 'data',
  keywords: ['iban', 'bban', 'qr-iban', 'bank', 'checksum', 'validate', 'swiss'],
  tags: ['checksum', 'bank'],
  added: '2026-10-24',
  examples: [{ input: 'GB82WEST12345698765432', expect: 'GB82 WEST' }],
};

export default meta;
