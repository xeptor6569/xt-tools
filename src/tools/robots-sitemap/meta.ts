import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'robots-sitemap',
  name: 'Robots and sitemap',
  description: 'Generate a robots.txt and a simple XML sitemap.',
  category: 'web',
  keywords: ['robots.txt', 'sitemap', 'seo', 'crawl'],
  examples: [
    {
      input: 'User-agent: *\nDisallow: /private\nhttps://example.com/a',
      expect: 'Disallow: /private',
    },
  ],
  added: '2026-10-24',
};

export default meta;
