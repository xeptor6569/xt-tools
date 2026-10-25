import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'wireguard',
  name: 'WireGuard config',
  description: 'Generate a WireGuard key pair and a starter configuration.',
  category: 'network',
  keywords: ['wireguard', 'vpn', 'x25519', 'config', 'key'],
  tags: ['vpn', 'key'],
  added: '2026-10-24',
  sensitive: true,
};

export default meta;
