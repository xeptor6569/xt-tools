import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'curl-converter',
  name: 'cURL converter',
  description: 'Turn a cURL command into fetch, Python or Go.',
  category: 'web',
  keywords: ['curl', 'fetch', 'python', 'go', 'http'],
  tags: ['http', 'curl'],
  examples: [
    {
      input: "curl https://example.com/api -X POST -H 'Content-Type: application/json' -d '{\"ok\":true}'",
      expect: 'method: "POST"',
    },
  ],
  added: '2026-10-24',
};

export default meta;
