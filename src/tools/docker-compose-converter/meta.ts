import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'docker-compose-converter',
  name: 'Docker run to Compose',
  description: 'Convert docker run commands to Docker Compose YAML, and Compose services back to docker run.',
  category: 'development',
  keywords: ['docker', 'compose', 'docker run', 'docker-compose', 'yaml', 'container', 'composerize', 'decomposerize'],
  added: '2026-10-24',
  examples: [
    { input: 'docker run -d -p 8080:80 --name web nginx:1.27', expect: 'image: nginx:1.27' },
    {
      input:
        "docker run -d --name db \\\n  -e POSTGRES_PASSWORD='s3cret$' \\\n  -v pgdata:/var/lib/postgresql/data \\\n  --restart unless-stopped \\\n  postgres:16",
      expect: 'POSTGRES_PASSWORD=s3cret$$',
    },
  ],
};

export default meta;
