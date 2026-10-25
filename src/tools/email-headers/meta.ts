import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'email-headers',
  name: 'Email headers',
  description: 'Parse email headers and unfold them, without any DNS lookup.',
  category: 'web',
  keywords: ['email', 'headers', 'received', 'parse', 'unfold'],
  examples: [{ input: 'Subject: Hello\n world', expect: 'Subject: Hello world' }],
  added: '2026-10-24',
};

export default meta;
