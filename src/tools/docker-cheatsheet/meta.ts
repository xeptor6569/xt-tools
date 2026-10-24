import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'docker-cheatsheet',
  name: 'Docker cheatsheet',
  description:
    'Searchable reference of Docker and Docker Compose commands for images, containers, volumes and networks.',
  category: 'development',
  keywords: ['docker', 'cheatsheet', 'container', 'image', 'compose', 'buildx', 'commands', 'reference'],
  added: '2026-10-24',
  examples: [{ input: 'system prune', expect: 'docker system prune' }],
};

export default meta;
