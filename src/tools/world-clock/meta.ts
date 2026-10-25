import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'world-clock',
  name: 'World clock',
  description: 'Show the current time in several time zones.',
  category: 'measurement',
  keywords: ['clock', 'timezone', 'world', 'time'],
  added: '2026-10-24',
  examples: [{ input: 'UTC', expect: 'UTC' }],
};

export default meta;
