import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'pdf-image-extractor',
  name: 'PDF image extractor',
  description: 'Extract embedded images from a PDF document without re-encoding JPEG streams.',
  category: 'documents',
  keywords: ['pdf', 'image', 'extract', 'xobject', 'jpeg', 'png', 'photos', 'document'],
  tags: ['pdf', 'images', 'extract'],
  added: '2026-11-06',
  heavy: true,
  examples: [
    {
      input:
        '<< /Type /XObject /Subtype /Image /Width 640 /Height 480 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>',
      expect: '#1: 640×480 DeviceRGB [DCTDecode] → image-1.jpg',
    },
  ],
};

export default meta;
