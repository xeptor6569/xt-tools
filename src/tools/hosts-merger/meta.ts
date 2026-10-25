import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'hosts-merger',
  name: 'Hosts merger',
  description: 'Merge hosts files and adblock lists and drop duplicate rules.',
  category: 'network',
  keywords: ['hosts', 'adblock', 'blocklist', 'merge', 'dedupe'],
  examples: [
    {
      input: '127.0.0.1 localhost\n||ads.example^\n0.0.0.0 ads.example\n# comment\n',
      expect: '0.0.0.0 ads.example',
    },
  ],
  added: '2026-10-24',
};

export default meta;
