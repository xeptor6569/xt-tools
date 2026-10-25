import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'vim-cheatsheet',
  name: 'Vim cheatsheet',
  description:
    'Searchable reference of Vim motions, text objects, editing, search and replace, registers, macros, windows and buffers.',
  category: 'development',
  group: 'cheatsheets',
  keywords: ['vim', 'vi', 'neovim', 'cheatsheet', 'keys', 'shortcuts', 'editor', 'motions', 'macros', 'reference'],
  tags: ['editor', 'cheatsheet'],
  added: '2026-10-24',
  examples: [{ input: 'record macro', expect: 'q{a-z}' }],
};

export default meta;
