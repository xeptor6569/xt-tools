import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'semver',
  name: 'Semver calculator',
  description: 'Sort and compare semantic versions, test them against npm-style ranges and compute the next version.',
  category: 'development',
  group: 'utilities',
  keywords: [
    'semver',
    'semantic versioning',
    'version',
    'range',
    'compare',
    'npm',
    'caret',
    'tilde',
    'sort versions',
    'increment',
    'bump',
    'prerelease',
  ],
  added: '2026-10-24',
  examples: [{ input: '1.10.0\n1.2.3\n1.2.10', expect: '1.2.3\n1.2.10\n1.10.0' }],
};

export default meta;
