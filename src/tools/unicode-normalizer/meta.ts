import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'unicode-normalizer',
  name: 'Unicode normalizer',
  description: 'Normalize text to NFC, NFD, NFKC or NFKD and see what changed.',
  category: 'text',
  keywords: ['unicode', 'normalize', 'nfc', 'nfd', 'nfkc', 'nfkd', 'combining'],
  examples: [{ input: 'ﬁnal café', expect: 'final café' }],
  added: '2026-10-18',
};

export default meta;
