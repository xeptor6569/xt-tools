import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'currency-converter',
  name: 'Currency converter',
  description: 'Convert an amount between currencies using the latest European Central Bank rates.',
  category: 'converter',
  group: 'units',
  keywords: ['currency', 'exchange', 'fx', 'ecb', 'frankfurter', 'convert'],
  added: '2026-10-24',
  network: { hosts: ['https://api.frankfurter.dev'] },
};

export default meta;
