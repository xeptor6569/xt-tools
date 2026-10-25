import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'patch-applier',
  name: 'Patch applier',
  description: 'Apply a unified diff patch to text and see the patched result, or which hunks failed and why.',
  category: 'development',
  group: 'utilities',
  keywords: ['patch', 'diff', 'unified diff', 'apply', 'git diff', 'git apply', 'hunk', 'reverse patch'],
  tags: ['diff', 'git'],
  added: '2026-10-24',
  examples: [
    {
      input: '--- /dev/null\n+++ b/hello.txt\n@@ -0,0 +1,2 @@\n+Hello from a patch\n+Second line\n',
      expect: 'Hello from a patch',
    },
  ],
};

export default meta;
