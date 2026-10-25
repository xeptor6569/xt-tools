import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'timer',
  name: 'Timer',
  description: 'Count down a duration, with a Pomodoro preset.',
  category: 'measurement',
  keywords: ['timer', 'countdown', 'pomodoro', 'alarm'],
  tags: ['time', 'timer'],
  added: '2026-10-24',
  examples: [{ input: '25', expect: '25:00' }],
};

export default meta;
