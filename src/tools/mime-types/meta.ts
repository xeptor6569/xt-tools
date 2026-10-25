import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'mime-types',
  name: 'MIME types',
  description: 'Look up a MIME type from an extension, or the extensions for a type.',
  category: 'web',
  keywords: ['mime', 'content-type', 'extension', 'media type'],
  tags: ['http', 'file'],
  examples: [{ input: '.png', expect: 'image/png' }],
  added: '2026-10-24',
  heavy: true,
};

export default meta;
