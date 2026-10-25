import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'og-meta-generator',
  name: 'Open Graph meta',
  description: 'Build Open Graph and Twitter card meta tags.',
  category: 'web',
  keywords: ['open graph', 'og', 'twitter', 'meta', 'seo'],
  examples: [
    {
      input: 'Hello | A page | https://example.com | https://example.com/a.png',
      expect: 'property="og:title" content="Hello"',
    },
  ],
  added: '2026-10-24',
};

export default meta;
