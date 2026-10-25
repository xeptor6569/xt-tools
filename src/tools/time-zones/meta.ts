import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'time-zones',
  name: 'Time zone converter',
  description: 'Convert a time between time zones and find meeting times that work everywhere.',
  category: 'converter',
  group: 'units',
  keywords: ['time zone', 'timezone', 'meeting planner', 'utc', 'world time', 'convert time'],
  tags: ['time', 'date'],
  examples: [{ input: '2026-10-14 09:00', expect: 'Meeting planner' }],
  added: '2026-10-18',
};

export default meta;
