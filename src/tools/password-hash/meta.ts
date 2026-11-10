import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'password-hash',
  name: 'Password hash',
  description: 'Hash and verify passwords with Argon2id, Argon2i, Argon2d, scrypt and PBKDF2.',
  category: 'crypto',
  keywords: ['argon2', 'argon2id', 'scrypt', 'pbkdf2', 'password', 'hash', 'kdf', 'verify'],
  tags: ['password', 'kdf', 'argon2'],
  added: '2026-11-06',
  sensitive: true,
  heavy: true,
  examples: [
    {
      input: 'algo: argon2id\nmemory: 512\niterations: 2\nparallelism: 1\nsalt: ssssssss\npassword',
      expect: '$argon2id$v=19$m=512,t=2,p=1$c3Nzc3Nzc3M$wdYS1hpl9YPIOBSn0hQMNZsUDI/qSzYunFl8YbtZmZI',
    },
    {
      input:
        'mode: verify\nhash: $argon2id$v=19$m=512,t=2,p=1$c3Nzc3Nzc3M$wdYS1hpl9YPIOBSn0hQMNZsUDI/qSzYunFl8YbtZmZI\npassword',
      expect: 'match',
    },
  ],
};

export default meta;
