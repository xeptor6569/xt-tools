import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'barcode-generator',
  name: 'Barcode generator',
  description: 'Draw a Code 128 or EAN-13 barcode on a canvas.',
  category: 'images-media',
  keywords: ['barcode', 'code128', 'ean', 'upc'],
  tags: ['barcode', 'image'],
  added: '2026-10-24',
  examples: [{ input: 'ean 590123412345', expect: '5901234123457' }],
};

export default meta;
