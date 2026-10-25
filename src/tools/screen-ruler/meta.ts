import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'screen-ruler',
  name: 'Screen ruler',
  description: 'Measure CSS pixels and estimate DPI from a known length.',
  category: 'measurement',
  keywords: ['ruler', 'dpi', 'pixels', 'screen'],
  added: '2026-10-24',
  examples: [{ input: '25.4 mm for 96 px', expect: '96 DPI' }],
};

export default meta;
