import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'tmux-cheatsheet',
  name: 'tmux cheatsheet',
  description: 'Searchable reference of tmux sessions, windows, panes, copy mode, key bindings and config snippets.',
  category: 'development',
  group: 'cheatsheets',
  keywords: ['tmux', 'terminal', 'multiplexer', 'cheatsheet', 'panes', 'sessions', 'shortcuts', 'prefix', 'reference'],
  tags: ['terminal', 'cheatsheet'],
  added: '2026-10-24',
  examples: [{ input: 'detach', expect: 'Ctrl-b d' }],
};

export default meta;
