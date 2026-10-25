import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'geo-converter',
  name: 'Geo converter',
  description: 'Convert coordinates between decimal degrees, DMS and geohash.',
  category: 'data',
  keywords: ['geohash', 'latitude', 'longitude', 'coordinates', 'dms'],
  tags: ['geo', 'coordinates'],
  added: '2026-10-24',
  examples: [{ input: '48.8584, 2.2945', expect: '48°51\'30.24"N' }],
};

export default meta;
