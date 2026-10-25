import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'http-status-codes',
  name: 'HTTP status codes',
  description: 'Look up HTTP status codes and their standard meanings.',
  category: 'web',
  keywords: ['http', 'status', '404', '500', 'code'],
  tags: ['http', 'reference'],
  examples: [{ input: '404', expect: 'Not Found' }],
  added: '2026-10-24',
};

export default meta;
