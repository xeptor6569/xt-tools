import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'crontab',
  name: 'Crontab explainer',
  description: 'Build a cron expression from its fields, explain it, and list the next run times.',
  category: 'development',
  group: 'utilities',
  keywords: ['cron', 'crontab', 'schedule', 'cron expression', 'cron generator', 'next run', 'job'],
  tags: ['cron', 'time'],
  examples: [{ input: '0 9 * * 1-5', expect: 'At 09:00, Monday through Friday' }],
  added: '2026-10-18',
};

export default meta;
