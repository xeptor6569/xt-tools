import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'unit-converter',
  name: 'Unit converter',
  description: 'Convert length, mass, temperature, data size (KB vs KiB), time, speed and more.',
  category: 'converter',
  group: 'units',
  keywords: [
    'unit',
    'convert',
    'length',
    'weight',
    'temperature',
    'celsius',
    'fahrenheit',
    'kib',
    'mib',
    'bytes',
    'temperature converter',
  ],
  tags: ['unit', 'convert'],
  examples: [{ input: '2.5', expect: '8.20209973753' }],
  added: '2026-10-18',
};

export default meta;
