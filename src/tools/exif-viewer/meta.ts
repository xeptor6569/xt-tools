import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'exif-viewer',
  name: 'EXIF viewer',
  description: 'Read EXIF fields from an image without uploading it.',
  category: 'images-media',
  keywords: ['exif', 'metadata', 'photo', 'gps'],
  added: '2026-10-24',
  heavy: true,
  examples: [{ input: '{"Make":"Canon"}', expect: 'Make: Canon' }],
};

export default meta;
