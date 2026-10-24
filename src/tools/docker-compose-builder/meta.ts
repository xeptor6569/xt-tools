import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'docker-compose-builder',
  name: 'Docker Compose builder',
  description:
    'Build a Docker Compose file with a form for services, ports, volumes, environment variables and networks.',
  category: 'development',
  group: 'generators',
  keywords: ['docker', 'compose', 'builder', 'compose.yaml', 'docker-compose', 'services', 'generator'],
  added: '2026-10-24',
  examples: [{ input: 'nginx:1.27', expect: 'image: nginx:1.27' }],
};

export default meta;
