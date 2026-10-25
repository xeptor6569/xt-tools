import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'date-difference',
  name: 'Date difference',
  description: 'Count days between two dates, including business days.',
  category: 'math',
  keywords: ['date', 'difference', 'business days', 'calendar'],
  tags: ['date', 'time'],
  added: '2026-10-24',
  examples: [{ input: '2026-01-01 2026-01-31', expect: 'Calendar days: 30' }],
};

export default meta;
