import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'http-snippet',
  name: 'HTTP snippet',
  description: 'Build an offline HTTP request snippet for fetch, Python or Go.',
  category: 'web',
  keywords: ['http', 'snippet', 'fetch', 'request', 'offline'],
  examples: [
    {
      input: 'POST https://example.com/api\nContent-Type: application/json\n\n{"ok":true}',
      expect: 'method: "POST"',
    },
  ],
  added: '2026-10-24',
};

export default meta;
