import type { ToolMeta } from '../types.ts';

const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const meta: ToolMeta = {
  id: 'jwt-debugger',
  name: 'JWT debugger',
  description: 'Decode, sign and verify a JWT, and flag the none algorithm.',
  category: 'crypto',
  keywords: ['jwt', 'jws', 'token', 'hs256', 'rs256', 'none'],
  examples: [
    { input: TOKEN, expect: 'John Doe' },
    {
      input:
        'mode: sign\nalg: HS256\nsecret: your-256-bit-secret\n{"sub":"1234567890","name":"John Doe","iat":1516239022}',
      expect: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    },
    {
      input: `secret: your-256-bit-secret\n${TOKEN}`,
      expect: 'valid: yes',
    },
    {
      input: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0In0.',
      expect: 'unsafe',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
