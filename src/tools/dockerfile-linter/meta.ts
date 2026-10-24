import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'dockerfile-linter',
  name: 'Dockerfile linter',
  description: 'Check a Dockerfile for common mistakes and best-practice issues, with an explanation for each finding.',
  category: 'development',
  keywords: ['dockerfile', 'docker', 'lint', 'linter', 'best practices', 'container', 'hadolint', 'buildkit'],
  added: '2026-10-24',
  examples: [
    { input: 'FROM ubuntu:latest\nRUN apt-get install curl', expect: 'uses the latest tag' },
    { input: 'FROM node:22\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD npm start', expect: 'CMD ["npm", "start"]' },
  ],
};

export default meta;
