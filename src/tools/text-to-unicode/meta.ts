import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'text-to-unicode',
  name: 'Text to Unicode',
  description: 'Show the Unicode code points of text and escape it for JavaScript, CSS, HTML and more.',
  category: 'converter',
  group: 'encodings',
  keywords: ['unicode', 'code point', 'escape', 'utf-16', 'html entity', 'u+'],
  examples: [{ input: 'café 🚀', expect: 'U+0063 U+0061 U+0066 U+00E9 U+0020 U+1F680' }],
  added: '2026-10-18',
};

export default meta;
