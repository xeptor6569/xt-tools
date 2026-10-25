import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'random-port',
  name: 'Random port generator',
  description: 'Pick random TCP/UDP port numbers from the registered or dynamic range, skipping well-known services.',
  category: 'development',
  group: 'generators',
  keywords: ['port', 'random', 'tcp', 'udp', 'ephemeral', 'dynamic port', 'free port'],
  tags: ['network', 'random'],
  added: '2026-10-24',
};

export default meta;
