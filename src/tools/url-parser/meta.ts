import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'url-parser',
  name: 'URL parser',
  description: 'Split a URL into its origin, path, query and fragment.',
  category: 'web',
  keywords: ['url', 'parse', 'query', 'origin', 'fragment'],
  examples: [
    {
      input: 'https://ada:secret@example.com:8443/a/b?x=1&y=2#top',
      expect: 'password: ••••',
    },
  ],
  added: '2026-10-24',
};

export default meta;
