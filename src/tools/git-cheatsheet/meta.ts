import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'git-cheatsheet',
  name: 'Git cheatsheet',
  description: 'Searchable reference of everyday Git commands, from setup and branching to undoing mistakes.',
  category: 'development',
  group: 'cheatsheets',
  keywords: ['git', 'cheatsheet', 'commands', 'branch', 'rebase', 'commit', 'stash', 'switch', 'restore', 'reference'],
  tags: ['git', 'cheatsheet'],
  added: '2026-10-24',
  examples: [{ input: 'stash pop', expect: 'git stash pop' }],
};

export default meta;
