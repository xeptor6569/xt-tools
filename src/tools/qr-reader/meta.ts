import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'qr-reader',
  name: 'QR reader',
  description: 'Read a QR code from an image file or the camera.',
  category: 'images-media',
  keywords: ['qr', 'scan', 'camera', 'decode'],
  added: '2026-10-24',
  requires: ['camera'],
  heavy: true,
};

export default meta;
