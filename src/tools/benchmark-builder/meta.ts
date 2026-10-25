import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'benchmark-builder',
  name: 'Benchmark builder',
  description: 'Compare measurements you type in, and never run any user code.',
  category: 'measurement',
  keywords: ['benchmark', 'compare', 'timing', 'measurement'],
  added: '2026-10-24',
  examples: [{ input: 'parse 20\nrender 10', expect: '1. render' }],
};

export default meta;
