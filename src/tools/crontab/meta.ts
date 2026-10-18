import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'crontab',
  name: 'Crontab explainer',
  description: 'Explain a cron schedule in plain English and list its next run times.',
  category: 'development',
  keywords: ['cron', 'crontab', 'schedule', 'cron expression', 'cron generator', 'next run', 'job'],
  examples: [{ input: '0 9 * * 1-5', expect: 'At 09:00, Monday through Friday' }],
  added: '2026-10-18',
};

export default meta;
