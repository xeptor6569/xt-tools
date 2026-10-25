import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'vat-validator',
  name: 'VAT validator',
  description: "Check a VAT number's format only, with no registry lookup.",
  category: 'data',
  keywords: ['vat', 'tax', 'format', 'eu'],
  added: '2026-10-24',
  examples: [{ input: 'DE136695976', expect: 'format-only' }],
};

export default meta;
