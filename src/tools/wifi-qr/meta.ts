import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'wifi-qr',
  name: 'WiFi QR code',
  description: 'Build a WiFi QR code from an SSID and password.',
  category: 'images-media',
  keywords: ['wifi', 'qr', 'ssid', 'password', 'wpa'],
  tags: ['qr', 'wifi'],
  added: '2026-10-24',
  sensitive: true,
  examples: [{ input: 'MyNet password', expect: 'WIFI:T:WPA;S:MyNet;P:password;;' }],
};

export default meta;
