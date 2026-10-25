import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'punycode',
  name: 'Punycode converter',
  description: 'Convert internationalized domain names to Punycode and back.',
  category: 'converter',
  group: 'encodings',
  keywords: ['punycode', 'idn', 'domain', 'xn--', 'unicode domain'],
  tags: ['encoding', 'dns'],
  examples: [
    { input: 'münchen.de', expect: 'xn--mnchen-3ya.de' },
    { input: 'xn--wgv71a119e.jp', expect: '日本語.jp' },
  ],
  added: '2026-10-18',
};

export default meta;
