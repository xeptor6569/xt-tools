import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'numeronym',
  name: 'Numeronym generator',
  description: 'Turn words into numeronyms like i18n, l10n and a11y.',
  category: 'text',
  group: 'transform',
  keywords: ['numeronym', 'i18n', 'a11y', 'abbreviation'],
  examples: [{ input: 'internationalization accessibility', expect: 'i18n a11y' }],
  added: '2026-10-18',
};

export default meta;
