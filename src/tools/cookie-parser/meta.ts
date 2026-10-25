import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'cookie-parser',
  name: 'Cookie parser',
  description: 'Parse a Cookie or Set-Cookie header into names and attributes.',
  category: 'web',
  keywords: ['cookie', 'set-cookie', 'parse', 'header'],
  examples: [{ input: 'session=abc; Path=/; HttpOnly', expect: 'HttpOnly: true' }],
  added: '2026-10-24',
};

export default meta;
