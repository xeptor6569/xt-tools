import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'file-checksum',
  name: 'File checksum',
  description: 'Hash a file and compare it with an expected checksum.',
  category: 'crypto',
  keywords: ['checksum', 'hash', 'file', 'sha256', 'blake3', 'verify'],
  tags: ['hash', 'file'],
  examples: [
    { input: 'abc', expect: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
    {
      input: 'algo: SHA-256\nexpect: ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad\nabc',
      expect: 'match',
    },
  ],
  added: '2026-10-24',
};

export default meta;
