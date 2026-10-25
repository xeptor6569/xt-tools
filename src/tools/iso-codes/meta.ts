import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'iso-codes',
  name: 'ISO codes',
  description: 'Look up countries, currencies and languages from Intl data.',
  category: 'data',
  keywords: ['iso', 'country', 'currency', 'language', 'intl'],
  tags: ['reference', 'country'],
  added: '2026-10-24',
  examples: [{ input: 'US', expect: 'United States' }],
};

export default meta;
