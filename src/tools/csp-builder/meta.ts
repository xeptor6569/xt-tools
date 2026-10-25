import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'csp-builder',
  name: 'CSP builder',
  description: 'Build a Content-Security-Policy and point out risky sources.',
  category: 'web',
  keywords: ['csp', 'content-security-policy', 'header', 'script-src'],
  tags: ['security', 'http'],
  examples: [{ input: "script-src 'self'", expect: "script-src 'self'" }],
  added: '2026-10-24',
};

export default meta;
