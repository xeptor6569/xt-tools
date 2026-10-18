import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'hash-text',
  name: 'Hash text',
  description: 'Hash text with SHA-2, SHA-3, BLAKE3, MD5, SHA-1, RIPEMD-160 and common checksums.',
  category: 'crypto',
  keywords: [
    'hash',
    'sha256',
    'sha512',
    'sha3',
    'md5',
    'sha1',
    'ripemd160',
    'blake3',
    'crc32',
    'adler32',
    'xxhash',
    'checksum',
    'digest',
  ],
  examples: [{ input: 'abc', expect: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }],
  added: '2026-10-18',
};

export default meta;
