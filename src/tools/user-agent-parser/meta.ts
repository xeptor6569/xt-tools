import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'user-agent-parser',
  name: 'User-agent parser',
  description: 'Parse a user-agent string into browser, engine and OS fields.',
  category: 'web',
  keywords: ['user-agent', 'browser', 'os', 'parse', 'ua'],
  tags: ['browser', 'http'],
  examples: [
    {
      input:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      expect: 'browser: Chrome',
    },
  ],
  added: '2026-10-24',
};

export default meta;
