import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'transfer-time',
  name: 'Transfer time',
  description: 'Estimate how long a transfer takes at a given bandwidth.',
  category: 'network',
  keywords: ['bandwidth', 'transfer', 'time', 'download', 'throughput'],
  tags: ['network', 'time'],
  examples: [
    { input: '1.5 GiB at 100 Mbps', expect: '2 min 8.849 sec' },
    { input: '1 GB at 1 MB/s', expect: '16 min 40 sec' },
  ],
  added: '2026-10-24',
};

export default meta;
