import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'phone-parser',
  name: 'Phone parser',
  description: 'Parse a phone number and show its country and national format.',
  category: 'data',
  keywords: ['phone', 'e164', 'libphonenumber', 'country'],
  added: '2026-10-24',
  heavy: true,
  examples: [{ input: '+442071838750', expect: '+44' }],
};

export default meta;
