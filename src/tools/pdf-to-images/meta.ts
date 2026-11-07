import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'pdf-to-images',
  name: 'PDF to images',
  description: 'Render PDF pages to PNG, JPEG or WebP images with pdf.js in your browser.',
  category: 'documents',
  keywords: ['pdf', 'images', 'render', 'png', 'jpeg', 'webp', 'rasterize', 'pages'],
  tags: ['pdf', 'images', 'converter'],
  added: '2026-11-06',
  heavy: true,
  examples: [
    {
      input: '612 792 144 png 0.92',
      expect: '1224×1584 px (144 DPI, 2.00x) png q=0.92',
    },
  ],
};

export default meta;
