import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'file-encrypt',
  name: 'File encrypt',
  description: 'Encrypt and decrypt a file with AES-GCM in chunks.',
  category: 'crypto',
  keywords: ['file', 'encrypt', 'decrypt', 'aes-gcm', 'chunk'],
  tags: ['encrypt', 'file'],
  examples: [
    {
      input:
        'password: secret\nn: 1024\nsalt-hex: 000102030405060708090a0b0c0d0e0f\nnonce-hex: 0102030405060708090a0b0c\nhello',
      expect: 'xtf1:WFRGMQAABAAIAQABAAAAAQIDBAUGBwgJCgsMDQ4PAQIDBAUGBwgJCgsMAAAAFaMxj8OrKtm0Wafqysg22MasZ+7kBQ',
    },
    {
      input:
        'mode: decrypt\npassword: secret\nxtf1:WFRGMQAABAAIAQABAAAAAQIDBAUGBwgJCgsMDQ4PAQIDBAUGBwgJCgsMAAAAFaMxj8OrKtm0Wafqysg22MasZ+7kBQ',
      expect: 'hello',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
