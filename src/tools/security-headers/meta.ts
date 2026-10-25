import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'security-headers',
  name: 'Security headers',
  description: 'Generate a starter set of HTTP security headers.',
  category: 'web',
  keywords: ['security', 'headers', 'hsts', 'csp', 'referrer'],
  tags: ['security', 'http'],
  examples: [{ input: '', expect: 'X-Content-Type-Options: nosniff' }],
  added: '2026-10-24',
};

export default meta;
