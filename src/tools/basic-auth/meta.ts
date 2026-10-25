import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'basic-auth',
  name: 'Basic auth',
  description: 'Build an HTTP Basic Authorization header from a username and password.',
  category: 'web',
  keywords: ['basic', 'auth', 'authorization', 'header', 'base64'],
  examples: [{ input: 'Aladdin:open sesame', expect: 'QWxhZGRpbjpvcGVuIHNlc2FtZQ==' }],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
