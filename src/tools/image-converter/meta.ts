import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'image-converter',
  name: 'Image converter',
  description: 'Resize, crop, compress and convert images to PNG, MozJPEG, WebP or AVIF in WebAssembly.',
  category: 'images-media',
  keywords: [
    'image',
    'resize',
    'crop',
    'compress',
    'convert',
    'png',
    'jpeg',
    'mozjpeg',
    'webp',
    'avif',
    'oxipng',
    'wasm',
  ],
  tags: ['image', 'convert', 'avif'],
  added: '2026-10-24',
  heavy: true,
  examples: [{ input: '1600 900 800 jpeg 0.8', expect: '800×450' }],
};

export default meta;
