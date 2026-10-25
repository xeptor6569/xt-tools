import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'date-time',
  name: 'Date-time converter',
  description: 'Convert dates between Unix timestamps, ISO 8601, RFC 2822 and local time, one or many at once.',
  category: 'converter',
  group: 'units',
  keywords: ['date', 'time', 'timestamp', 'unix', 'epoch', 'iso 8601', 'rfc 2822', 'batch unix timestamp converter'],
  tags: ['date', 'time'],
  examples: [
    { input: '1700000000', expect: '2023-11-14T22:13:20.000Z' },
    { input: '2026-10-14T10:00:00+02:00\n0', expect: '1970-01-01T00:00:00.000Z' },
  ],
  added: '2026-10-18',
};

export default meta;
