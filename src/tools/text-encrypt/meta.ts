import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'text-encrypt',
  name: 'Text encrypt',
  description: 'Encrypt and decrypt text with AES-GCM, and decrypt legacy ciphers only.',
  category: 'crypto',
  keywords: ['encrypt', 'decrypt', 'aes', 'aes-gcm', 'tripledes', 'rabbit', 'rc4'],
  tags: ['encrypt', 'text'],
  examples: [
    {
      input:
        'password: secret\nkdf: scrypt\nn: 1024\nsalt-hex: 00112233445566778899aabbccddeeff\nnonce-hex: 00112233445566778899aabb\nhello',
      expect: 'xt1.scrypt.1024.8.1.ABEiM0RVZneImaq7zN3u/w.ABEiM0RVZneImaq7.WY+hR3eDVU6pcWrJhLQ6k18oGGAi',
    },
    {
      input:
        'mode: decrypt\npassword: secret\nxt1.scrypt.1024.8.1.ABEiM0RVZneImaq7zN3u/w.ABEiM0RVZneImaq7.WY+hR3eDVU6pcWrJhLQ6k18oGGAi',
      expect: 'hello',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
