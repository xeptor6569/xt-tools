import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'safe-links-decoder',
  name: 'Safe Links decoder',
  description: 'Unwrap an Outlook Safe Links URL to the original address.',
  category: 'web',
  keywords: ['safelinks', 'outlook', 'url', 'decode', 'protection.outlook.com'],
  tags: ['url', 'email'],
  examples: [
    {
      input: 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fa&data=05',
      expect: 'https://example.com/a',
    },
  ],
  added: '2026-10-24',
};

export default meta;
